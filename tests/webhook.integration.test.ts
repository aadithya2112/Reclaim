import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { payments, recoveryCases } from "@/db/schema";
import { POST } from "@/app/api/webhooks/razorpay/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = testDatabaseUrl ? describe : describe.skip;
const caseId = "rc_test_webhook";
const linkId = "plink_test_webhook";
const referenceId = "rec_test_reference";

type PaymentBodyOptions = {
  event?: "payment_link.partially_paid" | "payment_link.paid";
  linkId?: string;
  currency?: string;
  referenceId?: string;
  amountPaid?: number;
  paymentAmount?: number;
  paymentId?: string;
};

function paymentBody({
  event = "payment_link.paid",
  linkId: bodyLinkId = linkId,
  currency = "INR",
  referenceId: bodyReferenceId = referenceId,
  amountPaid = 5_000_000,
  paymentAmount = 5_000_000,
  paymentId = "pay_test_webhook",
}: PaymentBodyOptions = {}) {
  return JSON.stringify({
    event,
    created_at: 1_779_000_000,
    payload: {
      payment_link: {
        entity: {
          id: bodyLinkId,
          amount: 5_000_000,
          amount_paid: amountPaid,
          currency,
          reference_id: bodyReferenceId,
          status:
            event === "payment_link.paid" ? "paid" : "partially_paid",
        },
      },
      payment: {
        entity: {
          id: paymentId,
          order_id: "order_test_webhook",
          amount: paymentAmount,
          currency,
          method: "card",
          captured: true,
          status: "captured",
          created_at: 1_779_000_000,
        },
      },
    },
  });
}

function requestFor(rawBody: string, eventId = "evt_test_webhook") {
  const signature = createHmac("sha256", "integration-webhook-secret")
    .update(rawBody)
    .digest("hex");
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body: rawBody,
  });
}

integration("Razorpay webhook database transaction", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.APP_URL = "https://recovery.example.com";
    process.env.RAZORPAY_KEY_ID = "rzp_test_integration";
    process.env.RAZORPAY_KEY_SECRET = "integration-key-secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "integration-webhook-secret";

    const db = getDb();
    await db.execute(sql`TRUNCATE TABLE operational_audit_events, human_approvals, policy_evaluations, promises, recovery_proposals, ai_decision_runs, customer_messages, payments, recovery_cases RESTART IDENTITY CASCADE`);
    await db.insert(recoveryCases).values({
      id: caseId,
      invoiceNumber: "INV-TEST-WEBHOOK",
      customerName: "Integration Test Customer",
      customerEmail: "integration@example.test",
      dueDate: "2026-07-15",
      amountDue: 5_000_000,
      razorpayPaymentLinkId: linkId,
      razorpayPaymentLinkUrl: "https://rzp.io/i/test",
      razorpayPaymentLinkReferenceId: referenceId,
      razorpayPaymentLinkAmount: 5_000_000,
      paymentLinkStartingRecovered: 0,
    });
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await closeDb();
  });

  it("records a partial payment once and adjusts the remaining balance", async () => {
    const body = paymentBody({
      event: "payment_link.partially_paid",
      amountPaid: 1_250_000,
      paymentAmount: 1_250_000,
      paymentId: "pay_test_partial",
    });
    const first = await POST(requestFor(body, "evt_test_partial"));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      kind: "partially_paid",
      status: "PARTIALLY_PAID",
      amountRecovered: 1_250_000,
      outstandingAmount: 3_750_000,
      outreachStatus: "ADJUSTED_TO_BALANCE",
    });

    const duplicate = await POST(requestFor(body, "evt_test_partial"));
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).kind).toBe("duplicate");

    const db = getDb();
    const [recoveryCase] = await db
      .select()
      .from(recoveryCases)
      .where(eq(recoveryCases.id, caseId));
    const recordedPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.recoveryCaseId, caseId));

    expect(recoveryCase.status).toBe("PARTIALLY_PAID");
    expect(recoveryCase.amountRecovered).toBe(1_250_000);
    expect(recordedPayments).toHaveLength(1);
    expect(recordedPayments[0]).toMatchObject({
      razorpayEventType: "payment_link.partially_paid",
      paymentLinkAmountPaid: 1_250_000,
    });
  });

  it("advances from partial to fully recovered using cumulative link truth", async () => {
    const partial = paymentBody({
      event: "payment_link.partially_paid",
      amountPaid: 1_250_000,
      paymentAmount: 1_250_000,
      paymentId: "pay_test_first_partial",
    });
    await POST(requestFor(partial, "evt_test_first_partial"));

    const finalPayment = paymentBody({
      amountPaid: 5_000_000,
      paymentAmount: 3_750_000,
      paymentId: "pay_test_remaining",
    });
    const response = await POST(
      requestFor(finalPayment, "evt_test_remaining"),
    );
    expect(await response.json()).toMatchObject({
      kind: "paid",
      status: "RECOVERED",
      amountRecovered: 5_000_000,
      outstandingAmount: 0,
      outreachStatus: "STOPPED",
    });

    const db = getDb();
    const [recoveryCase] = await db
      .select()
      .from(recoveryCases)
      .where(eq(recoveryCases.id, caseId));
    const recordedPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.recoveryCaseId, caseId));
    expect(recoveryCase.status).toBe("RECOVERED");
    expect(recordedPayments).toHaveLength(2);
    expect(
      recordedPayments.reduce((sum, payment) => sum + payment.amount, 0),
    ).toBe(5_000_000);
  });

  it("never regresses a recovered balance when an older partial event arrives late", async () => {
    const paid = paymentBody({
      amountPaid: 5_000_000,
      paymentAmount: 3_000_000,
      paymentId: "pay_test_final",
    });
    const paidResponse = await POST(requestFor(paid, "evt_test_final"));
    expect(await paidResponse.json()).toMatchObject({
      kind: "paid",
      status: "RECOVERED",
      amountRecovered: 5_000_000,
      outstandingAmount: 0,
      outreachStatus: "STOPPED",
    });

    const olderPartial = paymentBody({
      event: "payment_link.partially_paid",
      amountPaid: 2_000_000,
      paymentAmount: 2_000_000,
      paymentId: "pay_test_older_partial",
    });
    const lateResponse = await POST(
      requestFor(olderPartial, "evt_test_older_partial"),
    );
    expect(await lateResponse.json()).toMatchObject({
      kind: "partially_paid",
      status: "RECOVERED",
      amountRecovered: 5_000_000,
      outstandingAmount: 0,
      outreachStatus: "STOPPED",
    });

    const [recoveryCase] = await getDb()
      .select()
      .from(recoveryCases)
      .where(eq(recoveryCases.id, caseId));
    expect(recoveryCase.status).toBe("RECOVERED");
    expect(recoveryCase.amountRecovered).toBe(5_000_000);
    expect(recoveryCase.recoveredAt).not.toBeNull();
  });

  it("rejects unknown links, currency errors, and correlation mismatches", async () => {
    const unknown = await POST(
      requestFor(
        paymentBody({ linkId: "plink_unknown" }),
        "evt_unknown",
      ),
    );
    expect(unknown.status).toBe(404);

    const mismatch = await POST(
      requestFor(paymentBody({ currency: "USD" }), "evt_currency"),
    );
    expect(mismatch.status).toBe(422);

    const referenceMismatch = await POST(
      requestFor(
        paymentBody({ referenceId: "rec_wrong_reference" }),
        "evt_reference",
      ),
    );
    expect(referenceMismatch.status).toBe(422);

    const recordedPayments = await getDb()
      .select()
      .from(payments)
      .where(eq(payments.recoveryCaseId, caseId));
    expect(recordedPayments).toHaveLength(0);
  });
});
