import { afterEach, describe, expect, it, mock } from "bun:test";
import { createRazorpayPaymentLink } from "@/lib/razorpay";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Razorpay Payment Link client", () => {
  it("sends a full-payment Test Mode request with local case references", async () => {
    process.env.DATABASE_URL = "postgresql://recovery:recovery@localhost/recovery";
    process.env.APP_URL = "https://recovery.example.com";
    process.env.RAZORPAY_KEY_ID = "rzp_test_example";
    process.env.RAZORPAY_KEY_SECRET = "key-secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";

    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(request).toMatchObject({
        amount: 5_000_000,
        currency: "INR",
        accept_partial: false,
        reference_id: "rc_m1_inv_001",
        reminder_enable: false,
        callback_method: "get",
      });
      expect(request.callback_url).toBe(
        "https://recovery.example.com/?case=rc_m1_inv_001&checkout=returned",
      );

      return Response.json({
        id: "plink_test_link",
        short_url: "https://rzp.io/i/test",
        status: "created",
        amount: 5_000_000,
        currency: "INR",
        reference_id: "rc_m1_inv_001",
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const paymentLink = await createRazorpayPaymentLink({
      recoveryCaseId: "rc_m1_inv_001",
      invoiceNumber: "INV-001",
      amount: 5_000_000,
      currency: "INR",
    });

    expect(paymentLink.id).toBe("plink_test_link");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
