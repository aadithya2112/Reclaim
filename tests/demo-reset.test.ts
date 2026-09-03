import { describe, expect, it } from "bun:test";
import { DEMO_RECOVERY_CASE_IDS } from "@/db/demo-fixtures";
import { demoResetAllowed } from "@/db/demo-reset";
import { RECORDED_PAYMENT_FALLBACK } from "@/lib/recorded-demo";

describe("demo safety boundaries", () => {
  it("limits reset to the three named fixtures and requires production opt-in", () => {
    expect(DEMO_RECOVERY_CASE_IDS).toEqual(["rc_m1_inv_001", "rc_m1_inv_002", "rc_m7_inv_003"]);
    expect(demoResetAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(demoResetAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(demoResetAllowed({ NODE_ENV: "production", DEMO_RESET_ENABLED: "true" })).toBe(true);
  });

  it("keeps the recorded fallback outside payment truth and metrics", () => {
    expect(RECORDED_PAYMENT_FALLBACK.assertions).toEqual({
      razorpayInvoked: false,
      signatureVerified: false,
      ledgerWritten: false,
      recoveryMetricChanged: false,
    });
    expect(RECORDED_PAYMENT_FALLBACK.evidenceLabel).toContain("NO LEDGER WRITE");
  });
});
