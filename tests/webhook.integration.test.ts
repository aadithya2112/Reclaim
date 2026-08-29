import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { payments, recoveryCases } from "@/db/schema";
import { POST } from "@/app/api/webhooks/razorpay/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = testDatabaseUrl ? describe : describe.skip;
const caseId = "rc_test_webhook";
const linkId = "plink_test_webhook";

function paidBody(overrides: { linkId?: string; currency?: string } = {}) {
  return JSON.stringify({
    event: "payment_link.paid",
    created_at: 1_779_000_000,
    payload: {
      payment_link: {
        entity: {
          id: overrides.linkId ?? linkId,
          amount: 5_000_000,
          amount_paid: 5_000_000,
          currency: overrides.currency ?? "INR",
          reference_id: caseId,
          status: "paid",
        },
      },
      payment: {
        entity: {
          id: "pay_test_webhook",
          order_id: "order_test_webhook",
          amount: 5_000_000,
          currency: overrides.currency ?? "INR",
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
    await db.delete(payments).where(eq(payments.recoveryCaseId, caseId));
    await db.delete(recoveryCases).where(eq(recoveryCases.id, caseId));
    await db.insert(recoveryCases).values({
      id: caseId,
      invoiceNumber: "INV-TEST-WEBHOOK",
      customerName: "Integration Test Customer",
      customerEmail: "integration@example.test",
      dueDate: "2026-07-15",
      amountDue: 5_000_000,
      razorpayPaymentLinkId: linkId,
      razorpayPaymentLinkUrl: "https://rzp.io/i/test",
    });
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    const db = getDb();
    await db.delete(payments).where(eq(payments.recoveryCaseId, caseId));
    await db.delete(recoveryCases).where(eq(recoveryCases.id, caseId));
    await closeDb();
  });

  it("records once, recovers the case, and accepts a duplicate delivery", async () => {
    const first = await POST(requestFor(paidBody()));
    expect(first.status).toBe(200);

    const duplicate = await POST(requestFor(paidBody()));
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

    expect(recoveryCase.status).toBe("RECOVERED");
    expect(recoveryCase.amountRecovered).toBe(5_000_000);
    expect(recordedPayments).toHaveLength(1);
  });

  it("rejects unknown links and currency mismatches without recording", async () => {
    const unknown = await POST(
      requestFor(paidBody({ linkId: "plink_unknown" }), "evt_unknown"),
    );
    expect(unknown.status).toBe(404);

    const mismatch = await POST(
      requestFor(paidBody({ currency: "USD" }), "evt_currency"),
    );
    expect(mismatch.status).toBe(422);

    const recordedPayments = await getDb()
      .select()
      .from(payments)
      .where(eq(payments.recoveryCaseId, caseId));
    expect(recordedPayments).toHaveLength(0);
  });
});
