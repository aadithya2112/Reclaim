import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { DEMO_RECOVERY_CASE_IDS, DEMO_RECOVERY_CASES } from "@/db/demo-fixtures";
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

export function demoResetAllowed(environment: { NODE_ENV?: string; DEMO_RESET_ENABLED?: string } = process.env) {
  return environment.NODE_ENV !== "production" || environment.DEMO_RESET_ENABLED === "true";
}

/**
 * Resets only the three checked-in operational demo cases and their children.
 * This never drops schema, truncates tables, touches unrelated cases, or calls Razorpay.
 */
export async function resetOperationalDemo() {
  const db = getDb();
  return db.transaction(async (tx) => {
    const scope = inArray(recoveryCases.id, DEMO_RECOVERY_CASE_IDS);
    await tx.execute(sql`select set_config('recoup.demo_reset', 'enabled', true)`);
    await tx
      .update(recoveryCases)
      .set({ approvedProposalId: null })
      .where(scope);

    await tx.delete(humanApprovals).where(inArray(humanApprovals.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(policyEvaluations).where(inArray(policyEvaluations.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(promises).where(inArray(promises.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(recoveryProposals).where(inArray(recoveryProposals.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(aiDecisionRuns).where(inArray(aiDecisionRuns.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(customerMessages).where(inArray(customerMessages.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(payments).where(inArray(payments.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));
    await tx.delete(operationalAuditEvents).where(inArray(operationalAuditEvents.recoveryCaseId, DEMO_RECOVERY_CASE_IDS));

    for (const fixture of DEMO_RECOVERY_CASES) {
      await tx
        .insert(recoveryCases)
        .values(fixture)
        .onConflictDoUpdate({
          target: recoveryCases.id,
          set: {
            invoiceNumber: fixture.invoiceNumber,
            customerName: fixture.customerName,
            customerEmail: fixture.customerEmail,
            customerPhone: fixture.customerPhone,
            dueDate: fixture.dueDate,
            currency: fixture.currency,
            amountDue: fixture.amountDue,
            amountRecovered: 0,
            status: fixture.status,
            operationalQueueStatus: fixture.operationalQueueStatus,
            queuePriority: fixture.queuePriority,
            approvedProposalId: null,
            razorpayPaymentLinkId: null,
            razorpayPaymentLinkUrl: null,
            razorpayPaymentLinkReferenceId: null,
            razorpayPaymentLinkAmount: null,
            paymentLinkStartingRecovered: null,
            recoveredAt: null,
            createdAt: fixture.createdAt,
            updatedAt: fixture.updatedAt,
          },
        });
    }

    const restored = await tx
      .select({ id: recoveryCases.id })
      .from(recoveryCases)
      .where(scope);
    if (restored.length !== DEMO_RECOVERY_CASE_IDS.length) {
      throw new Error("Demo reset did not restore every expected fixture");
    }

    return {
      caseIds: [...DEMO_RECOVERY_CASE_IDS],
      localOnly: true,
      razorpayObjectsCancelled: false,
    };
  });
}
