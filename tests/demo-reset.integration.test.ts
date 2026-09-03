import { randomUUID } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { DEMO_RECOVERY_CASE_IDS } from "@/db/demo-fixtures";
import { resetOperationalDemo } from "@/db/demo-reset";
import {
  aiDecisionRuns,
  customerMessages,
  humanApprovals,
  operationalAuditEvents,
  payments,
  policyEvaluations,
  promises,
  recoveryCases,
  recoveryProposals,
} from "@/db/schema";
import { cachedDemoProposal, DEMO_MESSAGE, DEMO_RECEIVED_AT } from "@/lib/cached-commitment";
import { BUSINESS_TIMEZONE, stableHash, type CommitmentContext } from "@/lib/commitment-interpreter";

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("transactional operational demo reset", () => {
  it("restores only known fixtures and preserves unrelated records", async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const db = getDb();
    await resetOperationalDemo();

    const messageId = randomUUID();
    const runId = randomUUID();
    const proposalId = randomUUID();
    const unrelatedId = `rc_reset_unrelated_${randomUUID().slice(0, 8)}`;
    const context: CommitmentContext = {
      recoveryCaseId: "rc_m7_inv_003",
      invoiceNumber: "INV-003",
      amountDuePaise: 7_500_000,
      amountRecoveredPaise: 0,
      currency: "INR",
      message: DEMO_MESSAGE,
      messageReceivedAt: DEMO_RECEIVED_AT,
      businessTimezone: BUSINESS_TIMEZONE,
    };
    const proposal = cachedDemoProposal(context)!;

    try {
      await db.insert(recoveryCases).values({
        id: unrelatedId,
        invoiceNumber: `INV-RESET-${unrelatedId.slice(-8)}`,
        customerName: "Unrelated merchant record",
        customerEmail: "unrelated@example.test",
        dueDate: "2026-08-01",
        amountDue: 1_000_000,
      });
      await db.insert(customerMessages).values({ id: messageId, recoveryCaseId: context.recoveryCaseId, body: DEMO_MESSAGE, bodyHash: stableHash(DEMO_MESSAGE), businessTimezone: BUSINESS_TIMEZONE, receivedAt: new Date(DEMO_RECEIVED_AT) });
      await db.insert(aiDecisionRuns).values({ id: runId, recoveryCaseId: context.recoveryCaseId, customerMessageId: messageId, status: "CACHED_REPLAY", canonicalInputHash: stableHash(context), promptVersion: "test", schemaVersion: "test", providerPolicyVersion: "test", modelId: "test", privacyMode: "NO_PROVIDER_CALL", outputHash: stableHash(proposal), validatedOutput: proposal });
      await db.insert(recoveryProposals).values({ id: proposalId, recoveryCaseId: context.recoveryCaseId, customerMessageId: messageId, decisionRunId: runId, revision: 1, source: "CACHED_MODEL", proposalHash: stableHash(proposal), proposal, createdBy: "test" });
      await db.insert(policyEvaluations).values({ id: randomUUID(), recoveryCaseId: context.recoveryCaseId, proposalId, policyVersion: "test", outcome: "APPROVAL_REQUIRED", reasons: ["PARTIAL_PAYMENT"] });
      await db.insert(promises).values({ id: randomUUID(), recoveryCaseId: context.recoveryCaseId, proposalId, amountMode: "REMAINDER", promisedDate: "2026-09-04", status: "PENDING_VERIFICATION" });
      await db.insert(humanApprovals).values({ id: randomUUID(), recoveryCaseId: context.recoveryCaseId, proposalId, decision: "APPROVED", reviewer: "Reset test" });
      await db.insert(operationalAuditEvents).values({ id: randomUUID(), recoveryCaseId: context.recoveryCaseId, actor: "TEST", eventType: "TEST_EVENT", detail: "Scoped reset fixture", evidenceLabel: "TEST", payloadHash: stableHash("test"), metadata: {} });
      await db.insert(payments).values([
        { id: randomUUID(), recoveryCaseId: context.recoveryCaseId, razorpayPaymentId: `pay_reset_demo_${unrelatedId}`, razorpayPaymentLinkId: `plink_reset_demo_${unrelatedId}`, razorpayEventId: `evt_reset_demo_${unrelatedId}`, amount: 4_000_000, currency: "INR", method: "card", capturedAt: new Date(DEMO_RECEIVED_AT) },
        { id: randomUUID(), recoveryCaseId: unrelatedId, razorpayPaymentId: `pay_reset_unrelated_${unrelatedId}`, razorpayPaymentLinkId: `plink_reset_unrelated_${unrelatedId}`, razorpayEventId: `evt_reset_unrelated_${unrelatedId}`, amount: 100_000, currency: "INR", method: "upi", capturedAt: new Date(DEMO_RECEIVED_AT) },
      ]);
      await db.update(recoveryCases).set({ amountRecovered: 4_000_000, status: "PARTIALLY_PAID", operationalQueueStatus: "WAIT_PROTECTED", approvedProposalId: proposalId, razorpayPaymentLinkId: `plink_reset_demo_${unrelatedId}`, razorpayPaymentLinkUrl: "https://rzp.io/i/reset-test" }).where(eq(recoveryCases.id, context.recoveryCaseId));

      const result = await resetOperationalDemo();
      expect(result.caseIds).toEqual(DEMO_RECOVERY_CASE_IDS);

      const [demo] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, context.recoveryCaseId));
      expect(demo).toMatchObject({ amountRecovered: 0, status: "OPEN", operationalQueueStatus: "ACT_NOW", approvedProposalId: null, razorpayPaymentLinkId: null });
      const [unrelated] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, unrelatedId));
      expect(unrelated.customerName).toBe("Unrelated merchant record");
      expect(await db.select().from(payments).where(eq(payments.recoveryCaseId, unrelatedId))).toHaveLength(1);

      for (const table of [customerMessages, aiDecisionRuns, recoveryProposals, policyEvaluations, promises, humanApprovals, operationalAuditEvents, payments] as const) {
        expect(await db.select().from(table).where(inArray(table.recoveryCaseId, DEMO_RECOVERY_CASE_IDS))).toHaveLength(0);
      }
    } finally {
      await db.delete(payments).where(eq(payments.recoveryCaseId, unrelatedId));
      await db.delete(recoveryCases).where(eq(recoveryCases.id, unrelatedId));
    }
  });
});
