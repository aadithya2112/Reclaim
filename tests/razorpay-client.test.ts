import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  createRazorpayPaymentLink,
  minimumPartialPaymentFor,
} from "@/lib/razorpay";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Razorpay Payment Link client", () => {
  it("creates a partial-enabled Test Mode link with a bounded minimum and unique reference", async () => {
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
        accept_partial: true,
        first_min_partial_amount: 1_250_000,
        reminder_enable: false,
        callback_method: "get",
        notes: {
          recovery_case_id: "rc_m1_inv_001",
          invoice_number: "INV-001",
        },
      });
      expect(request.reference_id).toMatch(/^rec_[a-f0-9]{10}_[a-f0-9]{12}$/);
      expect(String(request.reference_id).length).toBeLessThanOrEqual(40);
      expect(request.callback_url).toBe(
        "https://recovery.example.com/collection?case=rc_m1_inv_001&checkout=returned",
      );

      return Response.json({
        id: "plink_test_link",
        short_url: "https://rzp.io/i/test",
        status: "created",
        amount: 5_000_000,
        currency: "INR",
        reference_id: String(request.reference_id),
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

  it("uses a ₹500 floor and rejects links too small for a meaningful partial payment", () => {
    expect(minimumPartialPaymentFor(100_000)).toBe(50_000);
    expect(minimumPartialPaymentFor(5_000_000)).toBe(1_250_000);
    expect(() => minimumPartialPaymentFor(50_000)).toThrow(
      "must exceed the minimum partial payment",
    );
  });
});
