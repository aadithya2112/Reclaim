import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promises, recoveryCases } from "@/db/schema";
import { POST as interpret } from "@/app/api/recovery-cases/[id]/interpret/route";
import { POST as approve } from "@/app/api/recovery-proposals/[id]/approval/route";
import { POST as createLink } from "@/app/api/recovery-cases/[id]/payment-link/route";
import { POST as webhook } from "@/app/api/webhooks/razorpay/route";
import { DEMO_MESSAGE } from "@/lib/cached-commitment";

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration("message → proposal → approval → Payment Link → webhook → promise → queue", () => {
  it("executes the full operational flow and serializes competing approvals", async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.APP_URL = "https://recovery.example.test";
    process.env.RAZORPAY_KEY_ID = "rzp_test_operational";
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
    const suffix = randomUUID().slice(0, 8);
    const caseId = `rc_operational_${suffix}`;
    const nextId = `rc_next_${suffix}`;
    const db = getDb();
    await db.insert(recoveryCases).values([
      { id: caseId, invoiceNumber: `INV-003-${suffix}`, customerName: "Northstar Test", customerEmail: "northstar@example.test", dueDate: "2026-07-20", amountDue: 7_500_000, operationalQueueStatus: "ACT_NOW", queuePriority: 100 },
      { id: nextId, invoiceNumber: `INV-NEXT-${suffix}`, customerName: "Next Test", customerEmail: "next@example.test", dueDate: "2026-07-15", amountDue: 5_000_000, operationalQueueStatus: "DEFERRED_CAPACITY", queuePriority: 80 },
    ]);

    const interpreted = await interpret(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: DEMO_MESSAGE, receivedAt: "2026-09-03T10:00:00+05:30", mode: "CACHED_REPLAY" }) }), { params: Promise.resolve({ id: caseId }) });
    expect(interpreted.status).toBe(200);
    const interpretedBody = await interpreted.json() as { proposalId: string; policy: { outcome: string } };
    expect(interpretedBody.policy.outcome).toBe("APPROVAL_REQUIRED");
    const blockedLink = await createLink(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: caseId }) });
    expect(blockedLink.status).toBe(409);

    const approvalRequest = () => new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "APPROVED", reviewer: "Integration reviewer" }) });
    const approvals = await Promise.all([
      approve(approvalRequest(), { params: Promise.resolve({ id: interpretedBody.proposalId }) }),
      approve(approvalRequest(), { params: Promise.resolve({ id: interpretedBody.proposalId }) }),
    ]);
    expect(approvals.map((response) => response.status).sort()).toEqual([200, 409]);
    const [approvedCase] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, caseId));
    expect(approvedCase.amountRecovered).toBe(0);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ id: `plink_${suffix}`, amount: 7_500_000, currency: "INR", reference_id: `rec_${suffix}`, short_url: "https://rzp.io/i/test", status: "created" }), { status: 200 })) as unknown as typeof fetch;
    try {
      const link = await createLink(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: caseId }) });
      expect(link.status).toBe(200);
    } finally { globalThis.fetch = originalFetch; }

    const rawBody = JSON.stringify({ event: "payment_link.partially_paid", created_at: 1_788_400_000, payload: { payment_link: { entity: { id: `plink_${suffix}`, amount: 7_500_000, amount_paid: 4_000_000, currency: "INR", reference_id: `rec_${suffix}`, status: "partially_paid" } }, payment: { entity: { id: `pay_${suffix}`, order_id: `order_${suffix}`, amount: 4_000_000, currency: "INR", method: "card", captured: true, status: "captured", created_at: 1_788_400_000 } } } });
    const signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
    const webhookResponse = await webhook(new Request("http://localhost", { method: "POST", headers: { "x-razorpay-signature": signature, "x-razorpay-event-id": `evt_${suffix}` }, body: rawBody }));
    expect(await webhookResponse.json()).toMatchObject({ amountRecovered: 4_000_000, outstandingAmount: 3_500_000, promiseActivated: true, promiseAmountPaise: 3_500_000, promotedCaseId: nextId });
    const [activePromise] = await db.select().from(promises).where(eq(promises.recoveryCaseId, caseId));
    const [currentCase] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, caseId));
    const [nextCase] = await db.select().from(recoveryCases).where(eq(recoveryCases.id, nextId));
    expect(activePromise).toMatchObject({ status: "ACTIVE", amountPaise: 3_500_000 });
    expect(currentCase.operationalQueueStatus).toBe("WAIT_PROTECTED");
    expect(nextCase.operationalQueueStatus).toBe("ACT_NOW");
  });
});
