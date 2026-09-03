import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { customerMessages, humanApprovals, operationalAuditEvents, policyEvaluations, promises, recoveryCases, recoveryProposals } from "@/db/schema";
import { BUSINESS_TIMEZONE, stableHash, validateCommitmentProposal } from "@/lib/commitment-interpreter";
import { auditValues, evidenceLabels, proposalFromJson } from "@/lib/operational-recovery";
import { evaluateOperationalPolicy, OPERATIONAL_POLICY_VERSION } from "@/lib/recovery-policy";

type RouteContext = { params: Promise<{ id: string }> };
const approvalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1_000).optional(),
  overrideProposal: z.unknown().optional(),
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const body = approvalSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid approval decision" }, { status: 400 });
  const { id } = await params;
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [original] = await tx.select().from(recoveryProposals).where(eq(recoveryProposals.id, id)).limit(1).for("update");
      if (!original) return { kind: "missing" as const };
      const [existing] = await tx.select().from(humanApprovals).where(eq(humanApprovals.proposalId, id)).limit(1);
      if (existing) return { kind: "conflict" as const };
      const [recoveryCase] = await tx.select().from(recoveryCases).where(eq(recoveryCases.id, original.recoveryCaseId)).limit(1).for("update");
      const [message] = await tx.select().from(customerMessages).where(eq(customerMessages.id, original.customerMessageId)).limit(1);
      if (!recoveryCase || !message) return { kind: "missing" as const };
      const [originalPolicy] = await tx.select().from(policyEvaluations).where(eq(policyEvaluations.proposalId, original.id)).orderBy(desc(policyEvaluations.evaluatedAt)).limit(1);
      if (!originalPolicy || originalPolicy.outcome === "BLOCKED") return { kind: "policy_blocked" as const, reasons: originalPolicy?.reasons ?? ["MISSING_POLICY_EVALUATION"] };

      let approvedProposalId = original.id;
      let approvedProposal = proposalFromJson(original.proposal);
      let overrideProposalId: string | null = null;
      if (body.data.overrideProposal !== undefined) {
        if (body.data.decision !== "APPROVED") return { kind: "invalid_override" as const, reasons: ["REJECTED_DECISION_CANNOT_HAVE_OVERRIDE"] };
        const context = { recoveryCaseId: recoveryCase.id, invoiceNumber: recoveryCase.invoiceNumber, amountDuePaise: recoveryCase.amountDue, amountRecoveredPaise: recoveryCase.amountRecovered, currency: "INR" as const, message: message.body, messageReceivedAt: message.receivedAt.toISOString(), businessTimezone: BUSINESS_TIMEZONE as typeof BUSINESS_TIMEZONE };
        const validated = validateCommitmentProposal(body.data.overrideProposal, context);
        if (!validated.success) return { kind: "invalid_override" as const, reasons: validated.reasons };
        approvedProposal = validated.data;
        const overridePolicy = evaluateOperationalPolicy(approvedProposal, { outstandingPaise: recoveryCase.amountDue - recoveryCase.amountRecovered, status: recoveryCase.status });
        if (overridePolicy.outcome === "BLOCKED") return { kind: "blocked_override" as const, reasons: overridePolicy.reasons };
        const [latest] = await tx.select({ revision: recoveryProposals.revision }).from(recoveryProposals).where(eq(recoveryProposals.recoveryCaseId, recoveryCase.id)).orderBy(desc(recoveryProposals.revision)).limit(1);
        overrideProposalId = crypto.randomUUID();
        approvedProposalId = overrideProposalId;
        await tx.insert(recoveryProposals).values({ id: overrideProposalId, recoveryCaseId: recoveryCase.id, customerMessageId: original.customerMessageId, decisionRunId: original.decisionRunId, parentProposalId: original.id, revision: (latest?.revision ?? original.revision) + 1, source: "REVIEWER_OVERRIDE", proposalHash: stableHash(approvedProposal), proposal: approvedProposal, createdBy: body.data.reviewer });
        await tx.insert(policyEvaluations).values({ id: crypto.randomUUID(), recoveryCaseId: recoveryCase.id, proposalId: overrideProposalId, policyVersion: OPERATIONAL_POLICY_VERSION, outcome: overridePolicy.outcome, reasons: overridePolicy.reasons });
        await tx.update(promises).set({ status: "CANCELLED", updatedAt: new Date() }).where(and(eq(promises.proposalId, original.id), eq(promises.status, "PENDING_VERIFICATION")));
        if (approvedProposal.promise_amount_mode !== "NONE" && approvedProposal.promised_date) await tx.insert(promises).values({ id: crypto.randomUUID(), recoveryCaseId: recoveryCase.id, proposalId: overrideProposalId, amountMode: approvedProposal.promise_amount_mode, promisedDate: approvedProposal.promised_date, amountPaise: approvedProposal.explicit_promised_amount_paise, status: "PENDING_VERIFICATION" });
      }

      const approvalId = crypto.randomUUID();
      await tx.insert(humanApprovals).values({ id: approvalId, recoveryCaseId: recoveryCase.id, proposalId: original.id, decision: body.data.decision, reviewer: body.data.reviewer, note: body.data.note, overrideProposalId });
      if (body.data.decision === "APPROVED") await tx.update(recoveryCases).set({ approvedProposalId, updatedAt: new Date() }).where(eq(recoveryCases.id, recoveryCase.id));
      await tx.insert(operationalAuditEvents).values(auditValues(recoveryCase.id, body.data.reviewer, body.data.decision === "APPROVED" ? "PROPOSAL_APPROVED" : "PROPOSAL_REJECTED", overrideProposalId ? "Reviewer approved a separate immutable override revision." : `Reviewer ${body.data.decision.toLowerCase()} the immutable model proposal.`, evidenceLabels.approval, { approvalId, originalProposalId: original.id, approvedProposalId: body.data.decision === "APPROVED" ? approvedProposalId : null, overrideProposalId, note: body.data.note ?? null }));
      return { kind: "ok" as const, approvalId, approvedProposalId: body.data.decision === "APPROVED" ? approvedProposalId : null, decision: body.data.decision };
    });
    if (result.kind === "missing") return Response.json({ error: "Proposal not found" }, { status: 404 });
    if (result.kind === "conflict") return Response.json({ error: "This proposal already has a human decision" }, { status: 409 });
    if (result.kind === "policy_blocked") return Response.json({ error: "Deterministic policy blocked this proposal", reasons: result.reasons }, { status: 422 });
    if (result.kind === "invalid_override" || result.kind === "blocked_override") return Response.json({ error: "Reviewer override is not policy-valid", reasons: result.reasons }, { status: 422 });
    return Response.json(result);
  } catch (error) {
    console.error("Approval transaction failed", error);
    return Response.json({ error: "Approval could not be recorded" }, { status: 500 });
  }
}
