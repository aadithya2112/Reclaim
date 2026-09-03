import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventEnvelopeSchema = z.object({
  event: z.string(),
});

const paymentEntitySchema = z.object({
  id: z.string().startsWith("pay_"),
  order_id: z.string().nullable().optional(),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  method: z.string().min(1),
  captured: z.literal(true),
  status: z.literal("captured"),
  created_at: z.number().int().positive(),
});

function paymentLinkEventSchema<
  TEvent extends "payment_link.partially_paid" | "payment_link.paid",
  TStatus extends "partially_paid" | "paid",
>(event: TEvent, status: TStatus) {
  return z.object({
  event: z.literal(event),
  created_at: z.number().int().positive(),
  payload: z.object({
    payment_link: z.object({
      entity: z.object({
        id: z.string().startsWith("plink_"),
        amount: z.number().int().positive(),
        amount_paid: z.number().int().positive(),
        currency: z.string().length(3),
        reference_id: z.string().min(1),
        status: z.literal(status),
      }),
    }),
    payment: z.object({
      entity: paymentEntitySchema,
    }),
  }),
});
}

export const partiallyPaidPaymentLinkEventSchema = paymentLinkEventSchema(
  "payment_link.partially_paid",
  "partially_paid",
);
export const paidPaymentLinkEventSchema = paymentLinkEventSchema(
  "payment_link.paid",
  "paid",
);
const supportedPaymentLinkEventSchema = z.discriminatedUnion("event", [
  partiallyPaidPaymentLinkEventSchema,
  paidPaymentLinkEventSchema,
]);

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function readWebhookEvent(rawBody: string) {
  let value: unknown;

  try {
    value = JSON.parse(rawBody);
  } catch {
    return { kind: "invalid" as const };
  }

  const envelope = eventEnvelopeSchema.safeParse(value);
  if (!envelope.success) return { kind: "invalid" as const };

  if (
    envelope.data.event !== "payment_link.partially_paid" &&
    envelope.data.event !== "payment_link.paid"
  ) {
    return { kind: "ignored" as const, event: envelope.data.event };
  }

  const parsed = supportedPaymentLinkEventSchema.safeParse(value);
  if (!parsed.success) {
    return { kind: "invalid" as const, issues: parsed.error.issues };
  }

  const link = parsed.data.payload.payment_link.entity;
  const payment = parsed.data.payload.payment.entity;
  const invalidAmounts =
    link.amount_paid > link.amount ||
    payment.amount > link.amount_paid ||
    (parsed.data.event === "payment_link.partially_paid" &&
      link.amount_paid >= link.amount) ||
    (parsed.data.event === "payment_link.paid" &&
      link.amount_paid !== link.amount);

  if (invalidAmounts || payment.currency !== link.currency) {
    return { kind: "invalid" as const };
  }

  return {
    kind: "payment" as const,
    event: parsed.data.event,
    data: parsed.data,
  };
}
