import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiDecisionRuns,
  customerMessages,
  humanApprovals,
  operationalAuditEvents,
  policyEvaluations,
  promises,
  recoveryCases,
  recoveryProposals,
} from "@/db/schema";
import { commitmentProposalSchema, stableHash, type CommitmentProposal } from "@/lib/commitment-interpreter";

export const evidenceLabels = {
  model: "MEASURED AGENT DECISION",
  cached: "CACHED MODEL REPLAY",
  policy: "DETERMINISTIC POLICY DECISION",
  approval: "HUMAN APPROVAL",
  webhook: "VERIFIED TEST WEBHOOK",
} as const;

export function auditValues(recoveryCaseId: string, actor: string, eventType: string, detail: string, evidenceLabel: string, metadata: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    recoveryCaseId,
    actor,
    eventType,
    detail,
    evidenceLabel,
    payloadHash: stableHash(metadata),
    metadata,
  };
}

export async function getOperationalReplay(recoveryCaseId: string) {
  const db = getDb();
  const [recoveryCase] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, recoveryCaseId)).limit(1);
  if (!recoveryCase) return null;
  const [messages, runs, proposalsRows, policies, approvals, promiseRows, audit, queue] = await Promise.all([
    db.select().from(customerMessages).where(eq(customerMessages.recoveryCaseId, recoveryCaseId)).orderBy(desc(customerMessages.createdAt)),
    db.select().from(aiDecisionRuns).where(eq(aiDecisionRuns.recoveryCaseId, recoveryCaseId)).orderBy(desc(aiDecisionRuns.createdAt)),
    db.select().from(recoveryProposals).where(eq(recoveryProposals.recoveryCaseId, recoveryCaseId)).orderBy(asc(recoveryProposals.revision)),
    db.select().from(policyEvaluations).where(eq(policyEvaluations.recoveryCaseId, recoveryCaseId)).orderBy(asc(policyEvaluations.evaluatedAt)),
    db.select().from(humanApprovals).where(eq(humanApprovals.recoveryCaseId, recoveryCaseId)).orderBy(asc(humanApprovals.createdAt)),
    db.select().from(promises).where(eq(promises.recoveryCaseId, recoveryCaseId)).orderBy(asc(promises.createdAt)),
    db.select().from(operationalAuditEvents).where(eq(operationalAuditEvents.recoveryCaseId, recoveryCaseId)).orderBy(asc(operationalAuditEvents.sequence)),
    db.select({ id: recoveryCases.id, invoiceNumber: recoveryCases.invoiceNumber, customerName: recoveryCases.customerName, outstandingPaise: recoveryCases.amountDue, amountRecovered: recoveryCases.amountRecovered, queueStatus: recoveryCases.operationalQueueStatus, queuePriority: recoveryCases.queuePriority }).from(recoveryCases).orderBy(desc(recoveryCases.queuePriority), asc(recoveryCases.id)),
  ]);
  return {
    messages: messages.map((message) => ({ ...message, receivedAt: message.receivedAt.toISOString(), createdAt: message.createdAt.toISOString() })),
    runs: runs.map((run) => ({ ...run, createdAt: run.createdAt.toISOString() })),
    proposals: proposalsRows.map((proposal) => ({ ...proposal, proposal: commitmentProposalSchema.parse(proposal.proposal), createdAt: proposal.createdAt.toISOString() })),
    policies: policies.map((policy) => ({ ...policy, evaluatedAt: policy.evaluatedAt.toISOString() })),
    approvals: approvals.map((approval) => ({ ...approval, createdAt: approval.createdAt.toISOString() })),
    promises: promiseRows.map((promise) => ({ ...promise, activatedAt: promise.activatedAt?.toISOString() ?? null, createdAt: promise.createdAt.toISOString(), updatedAt: promise.updatedAt.toISOString() })),
    audit: audit.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    queue: queue.map((item) => ({ ...item, outstandingPaise: item.outstandingPaise - item.amountRecovered })),
    approvedProposalId: recoveryCase.approvedProposalId,
  };
}

export function proposalFromJson(value: unknown): CommitmentProposal {
  return commitmentProposalSchema.parse(value);
}
