import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventEnvelopeSchema = z.object({
  event: z.string(),
});

export const paidPaymentLinkEventSchema = z.object({
  event: z.literal("payment_link.paid"),
  created_at: z.number().int().positive(),
  payload: z.object({
    payment_link: z.object({
      entity: z.object({
        id: z.string().startsWith("plink_"),
        amount: z.number().int().positive(),
        amount_paid: z.number().int().positive(),
        currency: z.string(),
        reference_id: z.string(),
        status: z.literal("paid"),
      }),
    }),
    payment: z.object({
      entity: z.object({
        id: z.string().startsWith("pay_"),
        order_id: z.string().nullable().optional(),
        amount: z.number().int().positive(),
        currency: z.string(),
        method: z.string(),
        captured: z.literal(true),
        status: z.literal("captured"),
        created_at: z.number().int().positive(),
      }),
    }),
  }),
});

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

  if (envelope.data.event !== "payment_link.paid") {
    return { kind: "ignored" as const, event: envelope.data.event };
  }

  const paidEvent = paidPaymentLinkEventSchema.safeParse(value);
  if (!paidEvent.success) {
    return { kind: "invalid" as const, issues: paidEvent.error.issues };
  }

  return { kind: "paid" as const, data: paidEvent.data };
}
