import { describe, expect, test } from "bun:test";
import { keyedUnit } from "../src/simulation/random";
import {
  allocateDailyWork,
  BaselineStrategy,
  compareStrategies,
  DEFAULT_CONFIG,
  evaluatePolicy,
  generatePortfolio,
  projectObservable,
  RazorpayNativeReminderBaselineStrategy,
  runSimulation,
} from "../src/simulation/simulator";
import type { SimulationCase, WorkCandidate } from "../src/simulation/types";

describe("deterministic recovery simulation", () => {
  test("portfolio is deterministic, varied by seed, and valid", () => {
    const a = generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 40 });
    const b = generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 40 });
    const c = generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 40, seed: 43 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const item of a.cases) {
      expect(item.outstandingPaise + item.recoveredPaise).toBe(item.originalAmountPaise);
      expect(item.outstandingPaise).toBeGreaterThanOrEqual(0);
    }
  });

  test("full runs reproduce cases, events, capacity records, and metrics", () => {
    const config = { caseCount: 30, days: 15, seed: 91, capacity: { dailyContactLimit: 6, dailyHumanReviewLimit: 2 } };
    const a = runSimulation(config);
    const b = runSimulation(config);
    expect(a).toEqual(b);
    expect(a.metrics.reconciliation.valid).toBe(true);
  });

  test("observable projection excludes latent traits", () => {
    const generated = generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 1 });
    const context = projectObservable(generated.cases[0], 0) as unknown as Record<string, unknown>;
    for (const key of ["profile", "responsiveness", "paymentAbility", "willingness", "disputePropensity", "promiseReliability", "partialTendency", "spontaneousPayment"]) expect(key in context).toBe(false);
    expect(new BaselineStrategy().decide(projectObservable(generated.cases[0], 0)).action).toBeString();
  });

  test("keyed randomness is independent of unrelated draw order", () => {
    const expected = keyedUnit(42, "case", 3, "response");
    keyedUnit(42, "unrelated");
    keyedUnit(99, "other");
    expect(keyedUnit(42, "case", 3, "response")).toBe(expected);
  });

  test("policy protects terminal, disputed, escalated, cooldown, limit, value, and promises", () => {
    const base = generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 1 }).cases[0];
    const check = (patch: Partial<SimulationCase>, day = 2) => evaluatePolicy(projectObservable({ ...base, ...patch }, day), "SEND_PAYMENT_REMINDER", DEFAULT_CONFIG.policy).rule;
    expect(check({ state: "RECOVERED", outstandingPaise: 0 })).toBe("TERMINAL_STOP");
    expect(check({ state: "DISPUTED", dispute: true })).toBe("DISPUTE_STOP");
    expect(check({ state: "ESCALATED", escalated: true })).toBe("ESCALATION_STOP");
    expect(check({ lastContactDay: 1 })).toBe("COOLDOWN");
    expect(check({ contactAttempts: 5, lastContactDay: null })).toBe("CONTACT_LIMIT");
    expect(check({ outstandingPaise: 3_000_000, lastContactDay: null })).toBe("HIGH_VALUE");
    expect(check({ promises: [{ id: "p", createdDay: 0, amountPaise: 1, dueDay: 3, status: "ACTIVE", amountFulfilledPaise: 0, paymentIds: [] }], lastContactDay: null })).toBe("PROMISE_PROTECTION");
    expect(check({ lastContactDay: 0 }, 2)).toBeUndefined();
  });

  test("daily contact and human-review budgets are never exceeded", () => {
    const result = runSimulation({ caseCount: 240, days: 18, seed: 42, capacity: { dailyContactLimit: 4, dailyHumanReviewLimit: 2 } });
    for (const day of result.dailyCapacity) {
      expect(day.contactConsumed).toBeLessThanOrEqual(4);
      expect(day.humanReviewConsumed).toBeLessThanOrEqual(2);
    }
    expect(result.metrics.capacity.contactConsumed).toBeLessThanOrEqual(18 * 4);
    expect(result.metrics.capacity.humanReviewConsumed).toBeLessThanOrEqual(18 * 2);
    expect(result.metrics.capacity.contactDeferredEligible).toBeGreaterThan(0);
    expect(result.metrics.capacity.humanReviewDeferredEligible).toBeGreaterThan(0);
  });

  test("protected cases and contacts consume neither capacity budget", () => {
    const result = runSimulation({ caseCount: 180, days: 20, seed: 18, capacity: { dailyContactLimit: 5, dailyHumanReviewLimit: 2 } });
    const protectedEvents = result.auditEvents.filter((event) => event.type === "QUEUE_CLASSIFIED" && event.metadata?.queue === "WAIT_PROTECTED");
    expect(protectedEvents.length).toBeGreaterThan(0);
    const selections = new Set(result.auditEvents.filter((event) => event.type === "CAPACITY_SELECTED").map((event) => `${event.simulationDay}:${event.caseId}`));
    for (const event of protectedEvents) expect(selections.has(`${event.simulationDay}:${event.caseId}`)).toBe(false);
    expect(result.metrics.safety.protectedContactsAvoided).toBeGreaterThan(0);
  });

  test("review and contact budgets are distinct and exhaustion reasons are explicit", () => {
    const result = runSimulation({ caseCount: 220, days: 1, seed: 7, capacity: { dailyContactLimit: 1, dailyHumanReviewLimit: 3 } });
    expect(result.dailyCapacity[0].contactConsumed).toBe(1);
    expect(result.dailyCapacity[0].humanReviewConsumed).toBe(3);
    const selected = result.auditEvents.filter((event) => event.type === "CAPACITY_SELECTED");
    expect(selected.filter((event) => event.metadata?.capacityKind === "CONTACT")).toHaveLength(1);
    expect(selected.filter((event) => event.metadata?.capacityKind === "HUMAN_REVIEW")).toHaveLength(3);
    expect(result.auditEvents.some((event) => event.type === "CAPACITY_DEFERRED" && event.metadata?.reason === "CONTACT_CAPACITY_EXHAUSTED")).toBe(true);
    expect(result.auditEvents.some((event) => event.type === "CAPACITY_DEFERRED" && event.metadata?.reason === "HUMAN_REVIEW_CAPACITY_EXHAUSTED")).toBe(true);
  });

  test("capacity allocation is stable and independent of candidate iteration order", () => {
    const candidate = (caseId: string, outstandingPaise: number): WorkCandidate => ({ caseId, outstandingPaise, action: "SEND_PAYMENT_REMINDER", capacityKind: "CONTACT", daysOverdue: 10, hasBrokenPromise: false, contactAttempts: 0 });
    const candidates = [candidate("case-c", 100), candidate("case-a", 100), candidate("case-b", 200)];
    const forward = allocateDailyWork(candidates, 2, 0);
    const reversed = allocateDailyWork([...candidates].reverse(), 2, 0);
    expect(forward).toEqual(reversed);
    expect(forward.selected.map((item) => item.caseId)).toEqual(["case-b", "case-a"]);
  });

  test("native reminder baseline is a disclosed fixed simulation schedule", () => {
    const strategy = new RazorpayNativeReminderBaselineStrategy();
    const c = projectObservable(generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 1 }).cases[0], 0);
    expect(strategy.decide(c).metadata).toMatchObject({ reminderScheduleDays: [0, 3, 7], simulationAssumption: true, invokesRazorpay: false, provesDelivery: false });
    const result = runSimulation({ caseCount: 80, days: 10, seed: 20, strategy: "razorpay-native-reminders", capacity: { dailyContactLimit: 80, dailyHumanReviewLimit: 10 } });
    const contactDays = new Set(result.auditEvents.filter((event) => event.type === "CUSTOMER_CONTACTED").map((event) => event.simulationDay));
    for (const day of contactDays) expect([0, 3, 7]).toContain(day);
  });

  test("strategy comparison uses equivalent portfolios and states the Milestone 4 boundary", () => {
    const comparison = compareStrategies({ caseCount: 40, days: 8, seed: 123, capacity: { dailyContactLimit: 5, dailyHumanReviewLimit: 2 } });
    expect(comparison.results.map((result) => result.config.strategy)).toEqual(["razorpay-native-reminders", "finance-age-bucket", "no-intervention"]);
    for (const result of comparison.results.slice(1)) expect(result.initialPortfolio).toEqual(comparison.results[0].initialPortfolio);
    expect(comparison.pairedOutcomeStatus).toBe("NOT_IMPLEMENTED_MILESTONE_4_PENDING");
    expect(comparison.limitation).toContain("not causal");
  });

  test("capacity validation accepts zero and rejects invalid budgets", () => {
    expect(() => runSimulation({ caseCount: 1, days: 1, capacity: { dailyContactLimit: 0, dailyHumanReviewLimit: 0 } })).not.toThrow();
    expect(() => runSimulation({ capacity: { dailyContactLimit: -1 } })).toThrow("dailyContactLimit");
    expect(() => runSimulation({ capacity: { dailyHumanReviewLimit: 1.5 } })).toThrow("dailyHumanReviewLimit");
  });

  test("payments, promises, disputes, stops, and metrics remain reconciled", () => {
    const result = runSimulation({ caseCount: 120, days: 30, seed: 42, capacity: { dailyContactLimit: 20, dailyHumanReviewLimit: 5 } });
    expect(result.metrics.reconciliation.valid).toBe(true);
    expect(result.metrics.recovery.totalRecoveredPaise).toBeLessThanOrEqual(result.metrics.portfolio.totalStartingOutstandingPaise);
    for (const c of result.finalCases) {
      expect(c.outstandingPaise).toBeGreaterThanOrEqual(0);
      expect(c.outstandingPaise + c.recoveredPaise).toBe(c.originalAmountPaise);
      if (c.state === "RECOVERED") expect(c.outstandingPaise).toBe(0);
      if (["DISPUTED", "ESCALATED", "CLOSED", "RECOVERED"].includes(c.state)) {
        const terminal = result.auditEvents.findIndex((event) => event.caseId === c.id && ["DISPUTE_DETECTED", "CASE_ESCALATED", "CASE_CLOSED", "CASE_RECOVERED"].includes(event.type));
        if (terminal >= 0) expect(result.auditEvents.slice(terminal + 1).filter((event) => event.caseId === c.id && event.type === "CUSTOMER_CONTACTED")).toHaveLength(0);
      }
    }
    expect(new Set(result.payments.map((payment) => payment.eventId)).size).toBe(result.payments.length);
    expect(new Set(result.payments.map((payment) => payment.paymentId)).size).toBe(result.payments.length);
  });
});
