import { expect, test } from "@playwright/test";

test("cached replay → approval → Razorpay handoff → verified promise and queue UI", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: /Interpret\. Approve\./ })).toBeVisible();
  await page.getByRole("button", { name: "Use cached replay" }).click();
  await expect(page.getByText("CACHED MODEL REPLAY", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("₹40,000", { exact: true })).toBeVisible();
  await expect(page.getByText("APPROVAL REQUIRED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve bounded action" }).click();
  await expect(page.getByText(/Human approved/)).toBeVisible();

  const caseResponse = await page.request.get("/api/recovery-cases/rc_m7_inv_003");
  const casePayload = await caseResponse.json();
  const replayResponse = await page.request.get("/api/recovery-cases/rc_m7_inv_003/replay");
  const replayPayload = await replayResponse.json();
  let handoff = false;
  await page.route("**/api/recovery-cases/rc_m7_inv_003/payment-link", async (route) => {
    handoff = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ paymentLink: { id: "plink_browser_test", shortUrl: "https://rzp.io/i/test", acceptsPartial: true }, reused: false }) });
  });
  await page.route("**/api/recovery-cases/rc_m7_inv_003", async (route) => {
    if (!handoff) return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recoveryCase: { ...casePayload.recoveryCase, amountRecovered: 4_000_000, status: "PARTIALLY_PAID", operationalQueueStatus: "WAIT_PROTECTED", razorpayPaymentLinkId: "plink_browser_test", razorpayPaymentLinkUrl: "https://rzp.io/i/test" } }) });
  });
  await page.route("**/api/recovery-cases/rc_m7_inv_003/replay", async (route) => {
    if (!handoff) return route.continue();
    const queue = replayPayload.replay.queue.map((item: { id: string }) => item.id === "rc_m7_inv_003" ? { ...item, queueStatus: "WAIT_PROTECTED", outstandingPaise: 3_500_000 } : item.id === "rc_m1_inv_001" ? { ...item, queueStatus: "ACT_NOW" } : item);
    const promises = replayPayload.replay.promises.map((item: { status: string }) => item.status === "PENDING_VERIFICATION" ? { ...item, status: "ACTIVE", amountPaise: 3_500_000, activationRazorpayEventId: "evt_browser_test" } : item);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ replay: { ...replayPayload.replay, queue, promises } }) });
  });
  await page.getByRole("button", { name: "Create approved Payment Link" }).click();
  await expect(page.getByRole("link", { name: /Open Razorpay Checkout/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "₹35,000 protected" })).toBeVisible();
  await expect(page.getByText("WAIT PROTECTED", { exact: true })).toBeVisible();
  await expect(page.getByText("ACT NOW", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/separate from the synthetic Recovery Frontier/)).toBeVisible();
});
