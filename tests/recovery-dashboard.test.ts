import { describe, expect, test } from "bun:test";
import { buildRecoveryDashboard } from "../src/lib/recovery-dashboard";

const controls = {
  scenario: "standard" as const,
  dailyContactLimit: 4,
  dailyHumanReviewLimit: 1,
};

const options = {
  caseCount: 24,
  days: 5,
  frontierContactLimits: [2, 4],
  developmentSeeds: [42, 91],
};

describe("Recovery Frontier dashboard projection", () => {
  test("is deterministic, reconciled, and contains every comparator", () => {
    const first = buildRecoveryDashboard(controls, options);
    const second = buildRecoveryDashboard(controls, options);
    expect(first).toEqual(second);
    expect(first.evidenceLabel).toBe("SYNTHETIC_DEVELOPMENT_BENCHMARK");
    expect(first.portfolio).toMatchObject({ cases: 24, virtualDays: 5, evaluationSet: "development", seed: 42 });
    expect(first.strategies.map((item) => item.strategy)).toEqual(["recoup-hybrid", "razorpay-native-reminders", "finance-age-bucket", "no-intervention"]);
    expect(first.frontier).toHaveLength(6);
    expect(first.frontier.every((point) => [2, 4].includes(point.dailyContactLimit))).toBe(true);
    expect(first.developmentRange.seeds).toEqual([42, 91]);
    expect(first.developmentRange.recoupRecoveredPaise.minimum).toBeLessThanOrEqual(first.developmentRange.recoupRecoveredPaise.maximum);
  });

  test("exposes only safe observable dashboard data", () => {
    const dashboard = buildRecoveryDashboard(controls, options);
    const serialized = JSON.stringify(dashboard);
    for (const forbidden of ["hiddenState", "potentialOutcomeBank", "responsiveness", "paymentAbility", "willingness", "promiseReliability", "partialTendency", "spontaneousPayment"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(dashboard.evidence.externalModelInvoked).toBe(false);
    expect(dashboard.evidence.razorpayInvoked).toBe(false);
    expect(dashboard.evidence.decisionCacheHash).toHaveLength(64);
    expect(dashboard.evidence.outcomeBankHash).toHaveLength(64);
  });

  test("projects bounded queues with replayable policy and decision evidence", () => {
    const dashboard = buildRecoveryDashboard(controls, options);
    expect(dashboard.dailyCapacity.contactsUsed).toBeLessThanOrEqual(controls.dailyContactLimit);
    expect(dashboard.dailyCapacity.reviewsUsed).toBeLessThanOrEqual(controls.dailyHumanReviewLimit);
    const cases = [...dashboard.queues.actNow, ...dashboard.queues.protected, ...dashboard.queues.deferred];
    expect(cases.length).toBeGreaterThan(0);
    for (const item of cases) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.policyReason.length).toBeGreaterThan(0);
      expect(item.timeline.length).toBeGreaterThan(0);
      expect(item.timeline.length).toBeLessThanOrEqual(10);
      expect(item.nativeBaseline.reason.length).toBeGreaterThan(0);
    }
    expect(dashboard.queues.actNow.every((item) => item.selected)).toBe(true);
    expect(dashboard.queues.deferred.every((item) => !item.selected)).toBe(true);
  });
});
