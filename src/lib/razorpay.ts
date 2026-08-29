import { z } from "zod";
import { getRazorpayEnv } from "@/lib/env";

const paymentLinkSchema = z.object({
  id: z.string().startsWith("plink_"),
  short_url: z.string().url(),
  status: z.string(),
  amount: z.number().int().positive(),
  currency: z.string(),
  reference_id: z.string(),
});

export type RazorpayPaymentLink = z.infer<typeof paymentLinkSchema>;

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type CreatePaymentLinkInput = {
  recoveryCaseId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
};

export async function createRazorpayPaymentLink({
  recoveryCaseId,
  invoiceNumber,
  amount,
  currency,
}: CreatePaymentLinkInput): Promise<RazorpayPaymentLink> {
  const env = getRazorpayEnv();
  const callbackUrl = new URL("/", env.APP_URL);
  callbackUrl.searchParams.set("case", recoveryCaseId);
  callbackUrl.searchParams.set("checkout", "returned");

  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      accept_partial: false,
      reference_id: recoveryCaseId,
      description: `Recovery for invoice ${invoiceNumber}`,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        recovery_case_id: recoveryCaseId,
        invoice_number: invoiceNumber,
      },
      callback_url: callbackUrl.toString(),
      callback_method: "get",
    }),
    cache: "no-store",
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = z
      .object({ error: z.object({ description: z.string() }) })
      .safeParse(body);
    throw new RazorpayApiError(
      message.success
        ? message.data.error.description
        : "Razorpay could not create the Payment Link",
      response.status,
    );
  }

  return paymentLinkSchema.parse(body);
}
