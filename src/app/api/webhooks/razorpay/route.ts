import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, recoveryCases } from "@/db/schema";
import { getRazorpayEnv } from "@/lib/env";
import { outreachStatusFor, recoveryStatusFor } from "@/lib/recovery";
import {
  readWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/razorpay-webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  let webhookSecret: string;
  try {
    webhookSecret = getRazorpayEnv().RAZORPAY_WEBHOOK_SECRET;
  } catch (error) {
    console.error("Razorpay environment is invalid", error);
    return Response.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  if (!eventId) {
    return Response.json({ error: "Missing Razorpay event ID" }, { status: 400 });
  }

  const webhook = readWebhookEvent(rawBody);
  if (webhook.kind === "ignored") {
    return Response.json({ received: true, ignored: webhook.event });
  }

  if (webhook.kind === "invalid") {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const paymentLink = webhook.data.payload.payment_link.entity;
  const payment = webhook.data.payload.payment.entity;
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [recoveryCase] = await tx
      .select()
      .from(recoveryCases)
      .where(eq(recoveryCases.razorpayPaymentLinkId, paymentLink.id))
      .limit(1)
      .for("update");

    if (!recoveryCase) return { kind: "unknown" as const };

    if (
      payment.currency !== recoveryCase.currency ||
      paymentLink.currency !== recoveryCase.currency
    ) {
      return { kind: "currency_mismatch" as const };
    }

    const linkAmount =
      recoveryCase.razorpayPaymentLinkAmount ?? paymentLink.amount;
    const startingRecovered =
      recoveryCase.paymentLinkStartingRecovered ??
      recoveryCase.amountDue - paymentLink.amount;
    const correlationMismatch =
      paymentLink.amount !== linkAmount ||
      startingRecovered < 0 ||
      startingRecovered + linkAmount !== recoveryCase.amountDue ||
      (recoveryCase.razorpayPaymentLinkReferenceId !== null &&
        paymentLink.reference_id !==
          recoveryCase.razorpayPaymentLinkReferenceId);

    if (correlationMismatch) return { kind: "correlation_mismatch" as const };

    const inserted = await tx
      .insert(payments)
      .values({
        id: crypto.randomUUID(),
        recoveryCaseId: recoveryCase.id,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id ?? null,
        razorpayPaymentLinkId: paymentLink.id,
        razorpayEventId: eventId,
        razorpayEventType: webhook.event,
        paymentLinkAmountPaid: paymentLink.amount_paid,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        capturedAt: new Date(payment.created_at * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });

    const cumulativeRecovered = startingRecovered + paymentLink.amount_paid;
    const amountRecovered = Math.max(
      recoveryCase.amountRecovered,
      cumulativeRecovered,
    );
    const status = recoveryStatusFor(
      recoveryCase.amountDue,
      amountRecovered,
    );
    const now = new Date();

    await tx
      .update(recoveryCases)
      .set({
        amountRecovered,
        status,
        razorpayPaymentLinkReferenceId: paymentLink.reference_id,
        razorpayPaymentLinkAmount: linkAmount,
        paymentLinkStartingRecovered: startingRecovered,
        recoveredAt:
          status === "RECOVERED" ? (recoveryCase.recoveredAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(recoveryCases.id, recoveryCase.id));

    return {
      kind:
        inserted.length === 0
          ? ("duplicate" as const)
          : webhook.event === "payment_link.partially_paid"
            ? ("partially_paid" as const)
            : ("paid" as const),
      recoveryCaseId: recoveryCase.id,
      status,
      amountRecovered,
      outstandingAmount: recoveryCase.amountDue - amountRecovered,
      outreachStatus: outreachStatusFor(status),
    };
  });

  if (result.kind === "unknown") {
    return Response.json({ error: "Unknown Payment Link" }, { status: 404 });
  }

  if (result.kind === "currency_mismatch") {
    return Response.json({ error: "Payment currency mismatch" }, { status: 422 });
  }

  if (result.kind === "correlation_mismatch") {
    return Response.json(
      { error: "Payment Link correlation mismatch" },
      { status: 422 },
    );
  }

  return Response.json({ received: true, ...result });
}
