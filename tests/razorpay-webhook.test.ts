import { createHmac } from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  readWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/razorpay-webhook";
import { recoveryStatusFor } from "@/lib/recovery";

const paidEvent = {
  event: "payment_link.paid",
  created_at: 1_779_000_000,
  payload: {
    payment_link: {
      entity: {
        id: "plink_test_link",
        amount: 5_000_000,
        amount_paid: 5_000_000,
        currency: "INR",
        reference_id: "rc_m1_inv_001",
        status: "paid",
      },
    },
    payment: {
      entity: {
        id: "pay_test_payment",
        order_id: "order_test_order",
        amount: 5_000_000,
        currency: "INR",
        method: "card",
        captured: true,
        status: "captured",
        created_at: 1_779_000_000,
      },
    },
  },
};

const partiallyPaidEvent = {
  ...structuredClone(paidEvent),
  event: "payment_link.partially_paid",
  payload: {
    ...structuredClone(paidEvent.payload),
    payment_link: {
      entity: {
        ...structuredClone(paidEvent.payload.payment_link.entity),
        amount_paid: 1_250_000,
        status: "partially_paid",
      },
    },
    payment: {
      entity: {
        ...structuredClone(paidEvent.payload.payment.entity),
        id: "pay_test_partial",
        amount: 1_250_000,
      },
    },
  },
};

describe("Razorpay webhook verification", () => {
  it("accepts a signature made from the untouched raw body", () => {
    const rawBody = JSON.stringify(paidEvent);
    const signature = createHmac("sha256", "test-secret")
      .update(rawBody)
      .digest("hex");

    expect(verifyWebhookSignature(rawBody, signature, "test-secret")).toBe(true);
  });

  it("rejects missing, malformed, and incorrect signatures", () => {
    const rawBody = JSON.stringify(paidEvent);
    expect(verifyWebhookSignature(rawBody, null, "test-secret")).toBe(false);
    expect(verifyWebhookSignature(rawBody, "not-hex", "test-secret")).toBe(false);
    expect(verifyWebhookSignature(rawBody, "0".repeat(64), "test-secret")).toBe(
      false,
    );
  });
});

describe("Razorpay webhook parsing", () => {
  it("extracts captured partial and fully paid Payment Link events", () => {
    for (const event of [partiallyPaidEvent, paidEvent]) {
      const result = readWebhookEvent(JSON.stringify(event));
      expect(result.kind).toBe("payment");
      if (result.kind !== "payment") continue;
      expect(result.event).toBe(
        event.event as
          | "payment_link.partially_paid"
          | "payment_link.paid",
      );
      expect(result.data.payload.payment.entity.amount).toBe(
        event.payload.payment.entity.amount,
      );
    }
  });

  it("ignores unrelated signed event types", () => {
    expect(readWebhookEvent(JSON.stringify({ event: "payment.failed" }))).toEqual({
      kind: "ignored",
      event: "payment.failed",
    });
  });

  it("rejects malformed and non-captured paid payloads", () => {
    expect(readWebhookEvent("not-json").kind).toBe("invalid");
    const notCaptured = structuredClone(paidEvent);
    notCaptured.payload.payment.entity.captured = false;
    expect(readWebhookEvent(JSON.stringify(notCaptured)).kind).toBe("invalid");

    const impossiblePartial = structuredClone(partiallyPaidEvent);
    impossiblePartial.payload.payment_link.entity.amount_paid = 5_000_000;
    expect(readWebhookEvent(JSON.stringify(impossiblePartial)).kind).toBe(
      "invalid",
    );

    const mismatchedCurrency = structuredClone(partiallyPaidEvent);
    mismatchedCurrency.payload.payment.entity.currency = "USD";
    expect(readWebhookEvent(JSON.stringify(mismatchedCurrency)).kind).toBe(
      "invalid",
    );
  });
});

describe("recovery threshold", () => {
  it("keeps a case open below the amount due", () => {
    expect(recoveryStatusFor(5_000_000, 0)).toBe("OPEN");
    expect(recoveryStatusFor(5_000_000, 4_999_999)).toBe("PARTIALLY_PAID");
  });

  it("recovers a case at or above the amount due", () => {
    expect(recoveryStatusFor(5_000_000, 5_000_000)).toBe("RECOVERED");
    expect(recoveryStatusFor(5_000_000, 5_000_001)).toBe("RECOVERED");
  });
});
