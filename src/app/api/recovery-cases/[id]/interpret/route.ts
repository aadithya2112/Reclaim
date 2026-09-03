import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { aiDecisionRuns, customerMessages, operationalAuditEvents, policyEvaluations, promises, recoveryCases, recoveryProposals } from "@/db/schema";
import { cachedDemoProposal } from "@/lib/cached-commitment";
import { BUSINESS_TIMEZONE, COMMITMENT_PROMPT_VERSION, COMMITMENT_SCHEMA_VERSION, detectPromptInjection, stableHash, validateCommitmentProposal, type CommitmentContext } from "@/lib/commitment-interpreter";
import { evidenceLabels, auditValues } from "@/lib/operational-recovery";
import { interpretWithOpenRouter, OPENROUTER_MODEL, OPENROUTER_PROVIDER_POLICY_VERSION, OpenRouterError } from "@/lib/openrouter";
import { evaluateOperationalPolicy, OPERATIONAL_POLICY_VERSION } from "@/lib/recovery-policy";

type RouteContext = { params: Promise<{ id: string }> };
const requestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  mode: z.enum(["LIVE", "CACHED_REPLAY"]).default("LIVE"),
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid customer message" }, { status: 400 });
  const { id } = await params;
  const db = getDb();
  const [recoveryCase] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, id)).limit(1);
  if (!recoveryCase) return Response.json({ error: "Recovery case not found" }, { status: 404 });
  if (recoveryCase.razorpayPaymentLinkId || recoveryCase.status === "RECOVERED") return Response.json({ error: "Interpretation is locked after collection handoff" }, { status: 409 });
  const receivedAt = input.data.receivedAt ? new Date(input.data.receivedAt) : new Date();
  const messageId = crypto.randomUUID();
  const context: CommitmentContext = {
    recoveryCaseId: recoveryCase.id,
    invoiceNumber: recoveryCase.invoiceNumber,
    amountDuePaise: recoveryCase.amountDue,
    amountRecoveredPaise: recoveryCase.amountRecovered,
    currency: "INR",
    message: input.data.message,
    messageReceivedAt: receivedAt.toISOString(),
    businessTimezone: BUSINESS_TIMEZONE,
  };
  const inputHash = stableHash(context);
  await db.insert(customerMessages).values({ id: messageId, recoveryCaseId: id, body: context.message, bodyHash: stableHash(context.message), businessTimezone: BUSINESS_TIMEZONE, receivedAt });
  await db.insert(operationalAuditEvents).values(auditValues(id, "CUSTOMER", "CUSTOMER_MESSAGE_RECEIVED", "Untrusted customer text entered the operational interpretation boundary.", "OPERATIONAL CUSTOMER MESSAGE", { messageId, bodyHash: stableHash(context.message), receivedAt: receivedAt.toISOString(), businessTimezone: BUSINESS_TIMEZONE }));

  if (detectPromptInjection(context.message)) {
    const runId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.select({ id: recoveryCases.id }).from(recoveryCases).where(eq(recoveryCases.id, id)).limit(1).for("update");
      await tx.update(recoveryCases).set({ approvedProposalId: null, updatedAt: new Date() }).where(eq(recoveryCases.id, id));
      await tx.update(promises).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(promises.recoveryCaseId, id));
      await tx.insert(aiDecisionRuns).values({ id: runId, recoveryCaseId: id, customerMessageId: messageId, status: "MANUAL_REVIEW", canonicalInputHash: inputHash, promptVersion: COMMITMENT_PROMPT_VERSION, schemaVersion: COMMITMENT_SCHEMA_VERSION, providerPolicyVersion: OPENROUTER_PROVIDER_POLICY_VERSION, modelId: OPENROUTER_MODEL, failureCode: "PROMPT_INJECTION_DETECTED", failureDetail: "Untrusted message matched an injection pattern; no provider call was made." });
      await tx.insert(operationalAuditEvents).values(auditValues(id, "SYSTEM", "MODEL_RUN_FAILED_CLOSED", "Prompt injection defense routed the message to manual review without executing model instructions.", evidenceLabels.policy, { runId, inputHash, reason: "PROMPT_INJECTION_DETECTED" }));
    });
    return Response.json({ status: "MANUAL_REVIEW", failureCode: "PROMPT_INJECTION_DETECTED", runId }, { status: 422 });
  }

  const runId = crypto.randomUUID();
  let rawOutput: unknown;
  let provider: string | null = null;
  let latencyMs = 0;
  try {
    if (input.data.mode === "CACHED_REPLAY") {
      rawOutput = cachedDemoProposal(context);
      if (!rawOutput) throw new OpenRouterError("INVALID_RESPONSE", "No frozen cached replay matches this exact case, message, and date context");
    } else {
      const result = await interpretWithOpenRouter(context);
      rawOutput = result.output;
      provider = result.provider;
      latencyMs = result.latencyMs;
    }
    const validated = validateCommitmentProposal(rawOutput, context);
    if (!validated.success) throw new OpenRouterError("INVALID_RESPONSE", validated.reasons.join(", "));
    const proposal = validated.data;
    const policy = evaluateOperationalPolicy(proposal, { outstandingPaise: recoveryCase.amountDue - recoveryCase.amountRecovered, status: recoveryCase.status });
    const proposalId = crypto.randomUUID();
    const policyId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.select({ id: recoveryCases.id }).from(recoveryCases).where(eq(recoveryCases.id, id)).limit(1).for("update");
      const [latest] = await tx.select({ revision: recoveryProposals.revision }).from(recoveryProposals).where(eq(recoveryProposals.recoveryCaseId, id)).orderBy(desc(recoveryProposals.revision)).limit(1);
      const revision = (latest?.revision ?? 0) + 1;
      await tx.insert(aiDecisionRuns).values({ id: runId, recoveryCaseId: id, customerMessageId: messageId, status: input.data.mode === "LIVE" ? "LIVE_SUCCESS" : "CACHED_REPLAY", canonicalInputHash: inputHash, promptVersion: COMMITMENT_PROMPT_VERSION, schemaVersion: COMMITMENT_SCHEMA_VERSION, providerPolicyVersion: OPENROUTER_PROVIDER_POLICY_VERSION, modelId: OPENROUTER_MODEL, providerName: provider, outputHash: stableHash(proposal), validatedOutput: proposal, latencyMs });
      await tx.insert(recoveryProposals).values({ id: proposalId, recoveryCaseId: id, customerMessageId: messageId, decisionRunId: runId, revision, source: input.data.mode === "LIVE" ? "MODEL" : "CACHED_MODEL", proposalHash: stableHash(proposal), proposal, createdBy: input.data.mode === "LIVE" ? OPENROUTER_MODEL : "frozen-demo-cache" });
      await tx.update(recoveryCases).set({ approvedProposalId: null, updatedAt: new Date() }).where(eq(recoveryCases.id, id));
      await tx.update(promises).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(promises.recoveryCaseId, id));
      await tx.insert(policyEvaluations).values({ id: policyId, recoveryCaseId: id, proposalId, policyVersion: OPERATIONAL_POLICY_VERSION, outcome: policy.outcome, reasons: policy.reasons });
      if (proposal.promise_amount_mode !== "NONE" && proposal.promised_date) await tx.insert(promises).values({ id: crypto.randomUUID(), recoveryCaseId: id, proposalId, amountMode: proposal.promise_amount_mode, promisedDate: proposal.promised_date, amountPaise: proposal.explicit_promised_amount_paise, status: "PENDING_VERIFICATION" });
      await tx.insert(operationalAuditEvents).values([
        auditValues(id, input.data.mode === "LIVE" ? "AI" : "CACHE", "PROPOSAL_CREATED", input.data.mode === "LIVE" ? "Live structured model output validated and frozen." : "Frozen structured output replayed; no live model call was made.", input.data.mode === "LIVE" ? evidenceLabels.model : evidenceLabels.cached, { runId, proposalId, revision, inputHash, outputHash: stableHash(proposal), model: OPENROUTER_MODEL }),
        auditValues(id, "POLICY", "POLICY_EVALUATED", `Policy outcome: ${policy.outcome}.`, evidenceLabels.policy, { proposalId, policyId, policyVersion: OPERATIONAL_POLICY_VERSION, reasons: policy.reasons }),
      ]);
    });
    return Response.json({ status: input.data.mode === "LIVE" ? "LIVE_SUCCESS" : "CACHED_REPLAY", runId, proposalId, proposal, policy });
  } catch (error) {
    const failure = error instanceof OpenRouterError ? error : new OpenRouterError("INVALID_RESPONSE", "Interpreter output could not be validated");
    await db.transaction(async (tx) => {
      await tx.select({ id: recoveryCases.id }).from(recoveryCases).where(eq(recoveryCases.id, id)).limit(1).for("update");
      await tx.update(recoveryCases).set({ approvedProposalId: null, updatedAt: new Date() }).where(eq(recoveryCases.id, id));
      await tx.update(promises).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(promises.recoveryCaseId, id));
      await tx.insert(aiDecisionRuns).values({ id: runId, recoveryCaseId: id, customerMessageId: messageId, status: "MANUAL_REVIEW", canonicalInputHash: inputHash, promptVersion: COMMITMENT_PROMPT_VERSION, schemaVersion: COMMITMENT_SCHEMA_VERSION, providerPolicyVersion: OPENROUTER_PROVIDER_POLICY_VERSION, modelId: OPENROUTER_MODEL, providerName: provider, failureCode: failure.code, failureDetail: failure.message, latencyMs });
      await tx.insert(operationalAuditEvents).values(auditValues(id, "SYSTEM", "MODEL_RUN_FAILED_CLOSED", "Interpreter failure routed the case to manual review; no action was authorized.", evidenceLabels.policy, { runId, inputHash, failureCode: failure.code }));
    });
    return Response.json({ status: "MANUAL_REVIEW", failureCode: failure.code, runId }, { status: 422 });
  }
}
