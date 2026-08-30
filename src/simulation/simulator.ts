import { createHash } from "node:crypto";
import { keyedInt, keyedUnit, stableId } from "./random";
import type {
  AuditEvent,
  CapacityAllocation,
  DailyCapacityRecord,
  HiddenCustomerState,
  ObservableRecoveryContext,
  PolicyConfig,
  PolicyResult,
  Profile,
  RecoveryAction,
  RecoveryDecision,
  RecoveryState,
  RecoveryStrategy,
  SimulationCase,
  SimulationConfig,
  SimulationConfigInput,
  SimulationMetrics,
  SimulationResult,
  StrategyComparison,
  StrategyName,
  SyntheticPaymentEvent,
  WorkCandidate,
} from "./types";
import { SIMULATOR_VERSION } from "./types";

export const DEFAULT_POLICY: PolicyConfig = { maxContactAttempts: 5, cooldownDays: 2, highValueThresholdPaise: 2_000_000 };
export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 42,
  caseCount: 1000,
  days: 30,
  startDate: "2026-01-01",
  strategy: "finance-age-bucket",
  scenario: "standard",
  policy: DEFAULT_POLICY,
  capacity: { dailyContactLimit: 100, dailyHumanReviewLimit: 10 },
};

export const STRATEGY_NAMES: StrategyName[] = ["razorpay-native-reminders", "finance-age-bucket", "no-intervention"];
const CONTACTS = new Set<RecoveryAction>(["SEND_GENTLE_REMINDER", "SEND_PAYMENT_REMINDER", "SEND_PAYMENT_LINK", "REQUEST_PAYMENT_COMMITMENT", "FOLLOW_UP_PROMISE"]);
const TERMINAL = new Set<RecoveryState>(["DISPUTED", "ESCALATED", "RECOVERED", "CLOSED"]);
const profiles: Profile[] = ["RELIABLE_LATE_PAYER", "CASHFLOW_CONSTRAINED", "LOW_RESPONSIVENESS", "DISPUTE_PRONE", "HIGH_RISK"];
const traits: Record<Profile, Omit<HiddenCustomerState, "profile">> = {
  RELIABLE_LATE_PAYER: { responsiveness: .82, paymentAbility: .82, willingness: .92, disputePropensity: .02, promiseReliability: .86, partialTendency: .12, spontaneousPayment: .025 },
  CASHFLOW_CONSTRAINED: { responsiveness: .7, paymentAbility: .38, willingness: .85, disputePropensity: .04, promiseReliability: .48, partialTendency: .62, spontaneousPayment: .008 },
  LOW_RESPONSIVENESS: { responsiveness: .2, paymentAbility: .68, willingness: .58, disputePropensity: .04, promiseReliability: .55, partialTendency: .22, spontaneousPayment: .004 },
  DISPUTE_PRONE: { responsiveness: .68, paymentAbility: .72, willingness: .48, disputePropensity: .32, promiseReliability: .52, partialTendency: .18, spontaneousPayment: .003 },
  HIGH_RISK: { responsiveness: .3, paymentAbility: .2, willingness: .3, disputePropensity: .14, promiseReliability: .2, partialTendency: .35, spontaneousPayment: .001 },
};

const clone = <T>(value: T): T => structuredClone(value);
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const isoDay = (start: string, day: number) => new Date(`${start}T00:00:00.000Z`).valueOf() + day * 86_400_000;
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const byCaseId = (a: SimulationCase, b: SimulationCase) => a.id.localeCompare(b.id);

function validateConfig(config: SimulationConfig): void {
  const positiveIntegers: Array<[string, number]> = [["caseCount", config.caseCount], ["days", config.days], ["maxContactAttempts", config.policy.maxContactAttempts], ["cooldownDays", config.policy.cooldownDays], ["highValueThresholdPaise", config.policy.highValueThresholdPaise]];
  if (!Number.isInteger(config.seed)) throw new Error("seed must be an integer");
  for (const [name, value] of positiveIntegers) {
    const minimum = name === "cooldownDays" ? 0 : 1;
    if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  for (const [name, value] of [["dailyContactLimit", config.capacity.dailyContactLimit], ["dailyHumanReviewLimit", config.capacity.dailyHumanReviewLimit]] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.startDate) || Number.isNaN(isoDay(config.startDate, 0))) throw new Error("startDate must be a valid YYYY-MM-DD date");
  if (config.scenario !== "standard") throw new Error("Only the standard scenario is currently supported");
}

export function generatePortfolio(config: SimulationConfig): { cases: SimulationCase[]; hidden: Record<string, HiddenCustomerState> } {
  const cases: SimulationCase[] = [];
  const hidden: Record<string, HiddenCustomerState> = {};
  const buckets = [[1, 5], [6, 15], [16, 30], [31, 60], [61, 100]];
  for (let i = 0; i < config.caseCount; i++) {
    const id = `sim-case-${String(i + 1).padStart(6, "0")}`;
    const profile = profiles[keyedInt(config.seed, 0, profiles.length - 1, "profile", i)];
    hidden[id] = { profile, ...traits[profile] };
    const amountRoll = keyedUnit(config.seed, "amount-tier", i);
    const [lo, hi] = amountRoll < .45 ? [5_000, 50_000] : amountRoll < .8 ? [50_001, 300_000] : amountRoll < .97 ? [300_001, 2_000_000] : [2_000_001, 10_000_000];
    const amount = keyedInt(config.seed, lo, hi, "amount", i);
    const bucket = buckets[keyedInt(config.seed, 0, 4, "overdue-bucket", i)];
    const overdue = keyedInt(config.seed, bucket[0], bucket[1], "overdue", i);
    const partial = keyedUnit(config.seed, "initial-partial", i) < .09;
    const recovered = partial ? Math.floor(amount * keyedInt(config.seed, 10, 45, "initial-partial-pct", i) / 100) : 0;
    const attempts = keyedUnit(config.seed, "attempted", i) < .18 ? keyedInt(config.seed, 1, 3, "attempts", i) : 0;
    const dispute = profile === "DISPUTE_PRONE" && keyedUnit(config.seed, "initial-dispute", i) < .12;
    const history = {
      historicalInvoices: keyedInt(config.seed, 1, 18, "hist", i),
      historicalLatePayments: keyedInt(config.seed, 0, 6, "late", i),
      priorPromises: keyedInt(config.seed, 0, 3, "promises", i),
      priorPromisesFulfilled: keyedInt(config.seed, 0, 2, "fulfilled", i),
      priorDisputes: keyedInt(config.seed, 0, profile === "DISPUTE_PRONE" ? 3 : 1, "disputes", i),
      riskSegment: (profile === "HIGH_RISK" ? "HIGH" : profile === "RELIABLE_LATE_PAYER" ? "LOW" : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
    };
    const dueMs = isoDay(config.startDate, -overdue);
    cases.push({
      id,
      customerId: `sim-customer-${String(i + 1).padStart(6, "0")}`,
      invoiceId: `SYN-INV-${String(i + 1).padStart(6, "0")}`,
      originalAmountPaise: amount,
      startingOutstandingPaise: amount - recovered,
      outstandingPaise: amount - recovered,
      recoveredPaise: recovered,
      initialRecoveredPaise: recovered,
      invoiceIssueDate: dateOnly(dueMs - 30 * 86_400_000),
      dueDate: dateOnly(dueMs),
      initialDaysOverdue: overdue,
      state: dispute ? "DISPUTED" : partial ? "PARTIALLY_PAID" : attempts ? "CONTACTED" : "OPEN",
      contactAttempts: attempts,
      lastContactDay: attempts ? -keyedInt(config.seed, 1, 5, "last-contact", i) : null,
      history,
      promises: [],
      dispute,
      escalated: false,
      closed: false,
      recoveredDay: null,
    });
  }
  return { cases, hidden };
}

export function projectObservable(c: SimulationCase, day: number): ObservableRecoveryContext {
  return { ...clone(c), simulationDay: day, daysOverdue: c.initialDaysOverdue + day };
}

export class FinanceAgeBucketStrategy implements RecoveryStrategy {
  readonly name = "finance-age-bucket" as const;
  decide(c: ObservableRecoveryContext): RecoveryDecision {
    if (c.outstandingPaise === 0 || TERMINAL.has(c.state)) return { action: "WAIT", reason: "Case is paid or terminal; the finance schedule stops." };
    if (c.promises.some((promise) => promise.status === "BROKEN")) return { action: "FOLLOW_UP_PROMISE", reason: "Observable promise was broken." };
    if (c.daysOverdue <= 5) return { action: "SEND_GENTLE_REMINDER", reason: "Finance age bucket: 1-5 days overdue." };
    if (c.daysOverdue <= 15) return { action: "SEND_PAYMENT_REMINDER", reason: "Finance age bucket: 6-15 days overdue." };
    if (c.daysOverdue <= 30) return { action: "SEND_PAYMENT_LINK", reason: "Finance age bucket: 16-30 days overdue." };
    if (c.daysOverdue <= 60) return { action: "REQUEST_PAYMENT_COMMITMENT", reason: "Finance age bucket: 31-60 days overdue." };
    return { action: "ESCALATE_TO_HUMAN", reason: "Finance age bucket: more than 60 days overdue requires human review." };
  }
}

/** Backward-compatible class name for the original finance age-bucket baseline. */
export class BaselineStrategy extends FinanceAgeBucketStrategy {}

export class RazorpayNativeReminderBaselineStrategy implements RecoveryStrategy {
  readonly name = "razorpay-native-reminders" as const;
  private readonly assumedReminderDays = new Set([0, 3, 7]);
  decide(c: ObservableRecoveryContext): RecoveryDecision {
    if (c.outstandingPaise === 0 || TERMINAL.has(c.state)) return { action: "WAIT", reason: "Case is paid or terminal; the simulated native reminder schedule stops." };
    if (!this.assumedReminderDays.has(c.simulationDay)) {
      return { action: "WAIT", reason: "No simulated native Payment Link reminder is scheduled today.", metadata: { reminderScheduleDays: [0, 3, 7], simulationAssumption: true } };
    }
    return {
      action: "SEND_PAYMENT_REMINDER",
      reason: "Simulated Razorpay-native Payment Link reminder on the disclosed fixed schedule.",
      metadata: { reminderScheduleDays: [0, 3, 7], simulationAssumption: true, invokesRazorpay: false, provesDelivery: false },
    };
  }
}

export class NoInterventionStrategy implements RecoveryStrategy {
  readonly name = "no-intervention" as const;
  decide(): RecoveryDecision { return { action: "WAIT", reason: "No-intervention comparator: allow only synthetic spontaneous and existing-promise outcomes." }; }
}

export function createStrategy(name: StrategyName): RecoveryStrategy {
  if (name === "razorpay-native-reminders") return new RazorpayNativeReminderBaselineStrategy();
  if (name === "no-intervention") return new NoInterventionStrategy();
  return new FinanceAgeBucketStrategy();
}

export function evaluatePolicy(c: ObservableRecoveryContext, proposed: RecoveryAction, policy: PolicyConfig): PolicyResult {
  const blocked = (reason: string, rule: string, executedAction: RecoveryAction = "WAIT"): PolicyResult => ({ proposedAction: proposed, allowed: false, reason, executedAction, rule });
  if (c.outstandingPaise === 0 || c.state === "RECOVERED" || c.state === "CLOSED") return blocked("Paid or terminal case cannot be automated.", "TERMINAL_STOP");
  if (c.dispute || c.state === "DISPUTED") return blocked("Disputed case cannot receive automated collection.", "DISPUTE_STOP");
  if (c.escalated || c.state === "ESCALATED") return blocked("Escalated case cannot receive automated collection.", "ESCALATION_STOP");
  if (CONTACTS.has(proposed) && c.promises.some((promise) => promise.status === "ACTIVE" && promise.dueDay >= c.simulationDay)) return blocked("Active promise suppresses contact.", "PROMISE_PROTECTION");
  if (CONTACTS.has(proposed) && c.contactAttempts >= policy.maxContactAttempts) return blocked("Automated contact limit reached; human review is eligible.", "CONTACT_LIMIT", "ESCALATE_TO_HUMAN");
  if (CONTACTS.has(proposed) && c.lastContactDay !== null && c.simulationDay - c.lastContactDay < policy.cooldownDays) return blocked("Contact cooldown has not elapsed.", "COOLDOWN");
  if (CONTACTS.has(proposed) && c.outstandingPaise >= policy.highValueThresholdPaise) return blocked("High-value case requires human review.", "HIGH_VALUE", "ESCALATE_TO_HUMAN");
  return { proposedAction: proposed, allowed: true, reason: "Action satisfies policy.", executedAction: proposed };
}

function candidateComparator(a: WorkCandidate, b: WorkCandidate): number {
  if (a.hasBrokenPromise !== b.hasBrokenPromise) return a.hasBrokenPromise ? -1 : 1;
  if (a.outstandingPaise !== b.outstandingPaise) return b.outstandingPaise - a.outstandingPaise;
  if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
  if (a.contactAttempts !== b.contactAttempts) return a.contactAttempts - b.contactAttempts;
  return a.caseId.localeCompare(b.caseId);
}

export function allocateDailyWork(candidates: readonly WorkCandidate[], contactLimit: number, humanReviewLimit: number): CapacityAllocation {
  const contacts = candidates.filter((item) => item.capacityKind === "CONTACT").sort(candidateComparator);
  const reviews = candidates.filter((item) => item.capacityKind === "HUMAN_REVIEW").sort(candidateComparator);
  return {
    selected: [...contacts.slice(0, contactLimit), ...reviews.slice(0, humanReviewLimit)],
    deferred: [...contacts.slice(contactLimit), ...reviews.slice(humanReviewLimit)],
  };
}

function transition(c: SimulationCase, next: RecoveryState): boolean {
  if (TERMINAL.has(c.state)) return c.state === next;
  c.state = next;
  c.dispute = next === "DISPUTED";
  c.escalated = next === "ESCALATED";
  c.closed = next === "CLOSED";
  return true;
}

export function runSimulation(input: SimulationConfigInput = {}, suppliedStrategy?: RecoveryStrategy): SimulationResult {
  const selectedName = suppliedStrategy?.name ?? input.strategy ?? DEFAULT_CONFIG.strategy;
  const config: SimulationConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    strategy: selectedName,
    policy: { ...DEFAULT_POLICY, ...input.policy },
    capacity: { ...DEFAULT_CONFIG.capacity, ...input.capacity },
  };
  validateConfig(config);
  const strategy = suppliedStrategy ?? createStrategy(config.strategy);
  const runId = createHash("sha256").update(`${SIMULATOR_VERSION}|${stableJson(config)}`).digest("hex").slice(0, 16);
  const generated = generatePortfolio(config);
  const initialPortfolio = clone(generated.cases).sort(byCaseId);
  const cases = clone(generated.cases).sort(byCaseId);
  const caseMap = new Map(cases.map((item) => [item.id, item]));
  const events: AuditEvent[] = [];
  const payments: SyntheticPaymentEvent[] = [];
  const dailyCapacity: DailyCapacityRecord[] = [];
  const paymentEvents = new Set<string>();
  const paymentIds = new Set<string>();
  let eventIndex = 0;
  const audit = (c: SimulationCase, day: number, type: string, source: AuditEvent["source"], reason: string, extra: Partial<AuditEvent> = {}) => {
    events.push({ eventId: `sim-audit-${String(++eventIndex).padStart(9, "0")}`, runId, caseId: c.id, simulationDay: day, simulatedAt: new Date(isoDay(config.startDate, day)).toISOString(), type, source, reason, ...extra });
  };
  const applyPayment = (c: SimulationCase, payment: SyntheticPaymentEvent) => {
    if (paymentEvents.has(payment.eventId) || paymentIds.has(payment.paymentId)) {
      audit(c, payment.simulationDay, "DUPLICATE_PAYMENT_IGNORED", "SIMULATION", "Duplicate synthetic payment ignored.", { amountPaise: payment.amountPaise });
      return 0;
    }
    paymentEvents.add(payment.eventId);
    paymentIds.add(payment.paymentId);
    const accepted = Math.min(Math.max(0, payment.amountPaise), c.outstandingPaise);
    if (!accepted) return 0;
    c.outstandingPaise -= accepted;
    c.recoveredPaise += accepted;
    payments.push({ ...payment, amountPaise: accepted });
    const promise = payment.promiseId ? c.promises.find((item) => item.id === payment.promiseId) : undefined;
    if (promise) {
      promise.amountFulfilledPaise = Math.min(promise.amountPaise, promise.amountFulfilledPaise + accepted);
      promise.paymentIds.push(payment.paymentId);
      promise.status = promise.amountFulfilledPaise >= promise.amountPaise ? "FULFILLED" : "PARTIALLY_FULFILLED";
      audit(c, payment.simulationDay, promise.status === "FULFILLED" ? "PROMISE_FULFILLED" : "PROMISE_PARTIALLY_FULFILLED", "SIMULATION", "Scheduled promise payment applied.", { amountPaise: accepted });
    }
    if (c.outstandingPaise === 0) {
      transition(c, "RECOVERED");
      c.recoveredDay = payment.simulationDay;
      audit(c, payment.simulationDay, "CASE_RECOVERED", "SIMULATION", "Outstanding balance reached zero.", { amountPaise: accepted });
    } else {
      transition(c, "PARTIALLY_PAID");
      audit(c, payment.simulationDay, "PARTIAL_PAYMENT_RECEIVED", "SIMULATION", payment.reason, { amountPaise: accepted });
    }
    return accepted;
  };

  for (const c of cases) audit(c, 0, "CASE_CREATED", "SIMULATION", "Synthetic recovery case generated.", { amountPaise: c.startingOutstandingPaise });
  for (let day = 0; day < config.days; day++) {
    // Phase 1: settle pre-decision environment events for the entire portfolio.
    for (const c of cases) {
      if (TERMINAL.has(c.state)) continue;
      for (const promise of c.promises.filter((item) => item.status === "ACTIVE" && item.dueDay === day)) {
        if (keyedUnit(config.seed, c.id, day, "promise-realization", promise.id) < generated.hidden[c.id].promiseReliability) {
          const fraction = keyedUnit(config.seed, c.id, day, "promise-full", promise.id) < .75 ? 1 : .5;
          applyPayment(c, { eventId: stableId("sim-event", config.seed, c.id, day, promise.id), paymentId: stableId("sim-payment", config.seed, c.id, day, promise.id), caseId: c.id, amountPaise: Math.floor(promise.amountPaise * fraction), simulationDay: day, source: "SIMULATION", reason: "Synthetic promise realization.", promiseId: promise.id });
        }
      }
      for (const promise of c.promises.filter((item) => item.status === "ACTIVE" && item.dueDay < day)) {
        promise.status = "BROKEN";
        audit(c, day, "PROMISE_BROKEN", "SIMULATION", "Promise remained unpaid after its due day.");
        if (c.state === "PROMISED") transition(c, "CONTACTED");
      }
      if (TERMINAL.has(c.state)) continue;
      if (keyedUnit(config.seed, c.id, day, "spontaneous") < generated.hidden[c.id].spontaneousPayment) {
        applyPayment(c, { eventId: stableId("sim-event", config.seed, c.id, day, "spontaneous"), paymentId: stableId("sim-payment", config.seed, c.id, day, "spontaneous"), caseId: c.id, amountPaise: c.outstandingPaise, simulationDay: day, source: "SIMULATION", reason: "Synthetic spontaneous payment." });
      }
    }

    // Phase 2: evaluate every case before selecting any bounded work.
    const candidates: WorkCandidate[] = [];
    const unboundedActions: Array<{ caseId: string; action: RecoveryAction; reason: string }> = [];
    let protectedDecisions = 0;
    let protectedContactActions = 0;
    for (const c of cases) {
      const context = projectObservable(c, day);
      audit(c, day, "CASE_EVALUATED", "STRATEGY", "Observable case evaluated before portfolio capacity allocation.");
      const decision = strategy.decide(context);
      audit(c, day, "ACTION_PROPOSED", "STRATEGY", decision.reason, { action: decision.action, metadata: decision.metadata });
      const policy = evaluatePolicy(context, decision.action, config.policy);
      audit(c, day, policy.allowed ? "ACTION_ALLOWED" : "ACTION_BLOCKED", "POLICY", policy.reason, { action: policy.executedAction, metadata: { proposedAction: decision.action, rule: policy.rule } });
      const action = policy.executedAction;
      const capacityKind = CONTACTS.has(action) ? "CONTACT" : action === "ESCALATE_TO_HUMAN" ? "HUMAN_REVIEW" : undefined;
      if (!capacityKind) {
        const policyProtected = !policy.allowed || TERMINAL.has(c.state) || c.promises.some((promise) => promise.status === "ACTIVE" && promise.dueDay >= day);
        protectedDecisions++;
        if (CONTACTS.has(decision.action) && action === "WAIT") protectedContactActions++;
        audit(c, day, "QUEUE_CLASSIFIED", "CAPACITY", policyProtected ? "WAIT / PROTECTED: no bounded capacity consumed." : "WAIT: strategy selected no intervention today.", { action: "WAIT", metadata: { queue: "WAIT_PROTECTED", policyProtected, proposedAction: decision.action, rule: policy.rule } });
        audit(c, day, "ACTION_EXECUTED", "POLICY", policy.reason, { action: "WAIT", metadata: { consumesCapacity: false } });
        if (action !== "WAIT") unboundedActions.push({ caseId: c.id, action, reason: policy.reason });
        continue;
      }
      candidates.push({ caseId: c.id, action, capacityKind, outstandingPaise: c.outstandingPaise, daysOverdue: context.daysOverdue, hasBrokenPromise: c.promises.some((promise) => promise.status === "BROKEN"), contactAttempts: c.contactAttempts });
      audit(c, day, "QUEUE_CLASSIFIED", "CAPACITY", `ACT NOW candidate requires ${capacityKind === "CONTACT" ? "contact" : "human-review"} capacity.`, { action, metadata: { queue: "ACT_NOW", capacityKind, proposedAction: decision.action, rule: policy.rule } });
    }

    // Phase 3: allocate each independent budget globally with an explicit stable tie-break.
    const allocation = allocateDailyWork(candidates, config.capacity.dailyContactLimit, config.capacity.dailyHumanReviewLimit);
    const contactSelected = allocation.selected.filter((item) => item.capacityKind === "CONTACT");
    const reviewSelected = allocation.selected.filter((item) => item.capacityKind === "HUMAN_REVIEW");
    const contactDeferred = allocation.deferred.filter((item) => item.capacityKind === "CONTACT");
    const reviewDeferred = allocation.deferred.filter((item) => item.capacityKind === "HUMAN_REVIEW");
    dailyCapacity.push({ simulationDay: day, contactBudget: config.capacity.dailyContactLimit, contactConsumed: contactSelected.length, contactDeferredEligible: contactDeferred.length, humanReviewBudget: config.capacity.dailyHumanReviewLimit, humanReviewConsumed: reviewSelected.length, humanReviewDeferredEligible: reviewDeferred.length, protectedDecisions, protectedContactActions });
    for (const item of allocation.selected) {
      const c = caseMap.get(item.caseId)!;
      audit(c, day, "CAPACITY_SELECTED", "CAPACITY", `${item.capacityKind === "CONTACT" ? "Contact" : "Human-review"} work selected within the daily budget.`, { action: item.action, metadata: { capacityKind: item.capacityKind, queue: "ACT_NOW", tieBreaker: c.id } });
    }
    for (const item of allocation.deferred) {
      const c = caseMap.get(item.caseId)!;
      audit(c, day, "CAPACITY_DEFERRED", "CAPACITY", `Eligible ${item.capacityKind === "CONTACT" ? "contact" : "human-review"} work deferred because its daily budget was exhausted.`, { action: item.action, metadata: { capacityKind: item.capacityKind, queue: "ACT_NOW", reason: item.capacityKind === "CONTACT" ? "CONTACT_CAPACITY_EXHAUSTED" : "HUMAN_REVIEW_CAPACITY_EXHAUSTED", tieBreaker: c.id } });
    }

    // Phase 4: execute only selected work in deterministic ranked order.
    for (const item of allocation.selected) {
      const c = caseMap.get(item.caseId)!;
      audit(c, day, "ACTION_EXECUTED", "CAPACITY", "Capacity-selected bounded action executed in the synthetic environment.", { action: item.action, metadata: { capacityKind: item.capacityKind, consumesCapacity: true } });
      if (item.capacityKind === "HUMAN_REVIEW") {
        transition(c, "ESCALATED");
        audit(c, day, "CASE_ESCALATED", "POLICY", "Capacity-selected case handed to a human reviewer.");
        continue;
      }
      c.contactAttempts++;
      c.lastContactDay = day;
      transition(c, "CONTACTED");
      audit(c, day, "CUSTOMER_CONTACTED", "SIMULATION", "Synthetic contact executed; no external channel or Razorpay reminder was invoked.", { action: item.action });
      const hidden = generated.hidden[c.id];
      const response = keyedUnit(config.seed, c.id, day, item.action, c.contactAttempts, "response");
      if (response > hidden.responsiveness) {
        audit(c, day, "CUSTOMER_NO_RESPONSE", "SIMULATION", "Synthetic customer did not respond.", { action: item.action });
        continue;
      }
      audit(c, day, "CUSTOMER_RESPONSE_RECEIVED", "SIMULATION", "Synthetic customer responded.", { action: item.action });
      const outcome = keyedUnit(config.seed, c.id, day, item.action, c.contactAttempts, "outcome");
      if (outcome < hidden.disputePropensity) {
        transition(c, "DISPUTED");
        audit(c, day, "DISPUTE_DETECTED", "SIMULATION", "Synthetic customer disputed the invoice.");
        continue;
      }
      const payChance = hidden.paymentAbility * hidden.willingness * (item.action === "SEND_PAYMENT_LINK" ? 1.15 : 1);
      if (outcome < payChance * .38) {
        const partial = keyedUnit(config.seed, c.id, day, "partial") < hidden.partialTendency;
        applyPayment(c, { eventId: stableId("sim-event", config.seed, c.id, day, "immediate", c.contactAttempts), paymentId: stableId("sim-payment", config.seed, c.id, day, "immediate", c.contactAttempts), caseId: c.id, amountPaise: partial ? Math.max(1, Math.floor(c.outstandingPaise * .35)) : c.outstandingPaise, simulationDay: day, source: "SIMULATION", reason: "Synthetic immediate response payment." });
      } else if (item.action === "REQUEST_PAYMENT_COMMITMENT" || item.action === "FOLLOW_UP_PROMISE" || outcome < payChance * .7) {
        const amount = keyedUnit(config.seed, c.id, day, "promise-amount") < hidden.partialTendency ? Math.max(1, Math.floor(c.outstandingPaise * .5)) : c.outstandingPaise;
        const promise = { id: stableId("sim-promise", config.seed, c.id, day, c.promises.length), createdDay: day, amountPaise: amount, dueDay: day + keyedInt(config.seed, 2, 7, c.id, day, "promise-due"), status: "ACTIVE" as const, amountFulfilledPaise: 0, paymentIds: [] };
        c.promises.push(promise);
        transition(c, "PROMISED");
        audit(c, day, "PROMISE_CREATED", "SIMULATION", "Synthetic customer made a dated promise.", { amountPaise: amount, metadata: { promiseId: promise.id, dueDay: promise.dueDay } });
      }
    }
    for (const item of unboundedActions) {
      const c = caseMap.get(item.caseId)!;
      if (item.action === "CLOSE_CASE") {
        transition(c, "CLOSED");
        audit(c, day, "CASE_CLOSED", "POLICY", item.reason);
      }
    }
  }

  for (const c of cases) {
    if (c.outstandingPaise < 0 || c.recoveredPaise + c.outstandingPaise !== c.originalAmountPaise) throw new Error(`Monetary invariant failed for ${c.id}`);
  }
  return { runId, config, initialPortfolio, hiddenState: generated.hidden, finalCases: cases, auditEvents: events, payments, dailyCapacity, metrics: calculateMetrics(initialPortfolio, cases, events, dailyCapacity) };
}

export function compareStrategies(input: SimulationConfigInput = {}, names: StrategyName[] = STRATEGY_NAMES): StrategyComparison {
  const uniqueNames = [...new Set(names)];
  if (!uniqueNames.length) throw new Error("At least one strategy is required for comparison");
  const results = uniqueNames.map((strategy) => runSimulation({ ...input, strategy }));
  const first = results[0].config;
  const commonConfig = { seed: first.seed, caseCount: first.caseCount, days: first.days, startDate: first.startDate, scenario: first.scenario, policy: first.policy, capacity: first.capacity };
  const comparisonId = createHash("sha256").update(`${SIMULATOR_VERSION}|comparison|${stableJson(commonConfig)}|${uniqueNames.join("|")}`).digest("hex").slice(0, 16);
  return {
    comparisonId,
    evidenceLabel: "SYNTHETIC_STRATEGY_COMPARISON",
    pairedOutcomeStatus: "NOT_IMPLEMENTED_MILESTONE_4_PENDING",
    limitation: "Strategies share the same generated starting portfolio and keyed hidden assumptions, but action-specific potential outcomes are not frozen into a paired bank until Milestone 4. Differences are synthetic scenario outputs, not causal or real-world recovery estimates.",
    commonConfig,
    results,
  };
}

export function calculateMetrics(initial: SimulationCase[], finalCases: SimulationCase[], events: AuditEvent[], dailyCapacity: DailyCapacityRecord[] = []): SimulationMetrics {
  const starting = initial.reduce((sum, c) => sum + c.startingOutstandingPaise, 0);
  const ending = finalCases.reduce((sum, c) => sum + c.outstandingPaise, 0);
  const recovered = starting - ending;
  const full = finalCases.filter((c) => c.outstandingPaise === 0);
  const partial = finalCases.filter((c) => c.recoveredPaise > c.initialRecoveredPaise && c.outstandingPaise > 0);
  const count = (type: string) => events.filter((event) => event.type === type).length;
  const action = (value: RecoveryAction) => events.filter((event) => event.type === "ACTION_EXECUTED" && event.action === value).length;
  const contacts = count("CUSTOMER_CONTACTED");
  const promises = finalCases.flatMap((c) => c.promises);
  const recoveryDays = full.map((c) => c.recoveredDay).filter((value): value is number => value !== null);
  const sumCapacity = (key: keyof DailyCapacityRecord) => dailyCapacity.reduce((sum, day) => sum + Number(day[key]), 0);
  const contactBudget = sumCapacity("contactBudget");
  const contactConsumed = sumCapacity("contactConsumed");
  const reviewBudget = sumCapacity("humanReviewBudget");
  const reviewConsumed = sumCapacity("humanReviewConsumed");
  const protectedCaseIds = new Set(events.filter((event) => event.type === "QUEUE_CLASSIFIED" && event.metadata?.queue === "WAIT_PROTECTED" && event.metadata?.policyProtected === true).map((event) => event.caseId));
  return {
    portfolio: { totalCases: finalCases.length, totalOriginalInvoicePaise: initial.reduce((sum, c) => sum + c.originalAmountPaise, 0), totalStartingOutstandingPaise: starting },
    recovery: { totalRecoveredPaise: recovered, recoveryRate: starting ? recovered / starting : 0, fullyRecoveredCases: full.length, partiallyRecoveredCases: partial.length, unresolvedCases: finalCases.filter((c) => c.outstandingPaise > 0 && !c.dispute && !c.escalated && !c.closed).length, disputedCases: finalCases.filter((c) => c.dispute).length, escalatedCases: finalCases.filter((c) => c.escalated).length, averageDaysToFullRecovery: recoveryDays.length ? recoveryDays.reduce((a, b) => a + b, 0) / recoveryDays.length : 0 },
    interventions: { gentleReminders: action("SEND_GENTLE_REMINDER"), paymentReminders: action("SEND_PAYMENT_REMINDER"), paymentLinks: action("SEND_PAYMENT_LINK"), commitmentRequests: action("REQUEST_PAYMENT_COMMITMENT"), promiseFollowUps: action("FOLLOW_UP_PROMISE"), waits: action("WAIT"), escalations: action("ESCALATE_TO_HUMAN"), customerContacts: contacts },
    promises: { created: promises.length, fulfilled: promises.filter((p) => p.status === "FULFILLED").length, partiallyFulfilled: promises.filter((p) => p.status === "PARTIALLY_FULFILLED").length, broken: promises.filter((p) => p.status === "BROKEN").length, fulfillmentRate: promises.length ? promises.filter((p) => p.status === "FULFILLED").length / promises.length : 0 },
    safety: { policyBlocks: count("ACTION_BLOCKED"), cooldownBlocks: events.filter((e) => e.metadata?.rule === "COOLDOWN").length, communicationLimitBlocks: events.filter((e) => e.metadata?.rule === "CONTACT_LIMIT").length, promiseProtectionBlocks: events.filter((e) => e.metadata?.rule === "PROMISE_PROTECTION").length, disputeStops: events.filter((e) => e.metadata?.rule === "DISPUTE_STOP").length, terminalStops: events.filter((e) => e.metadata?.rule === "TERMINAL_STOP").length, highValueEscalations: events.filter((e) => e.metadata?.rule === "HIGH_VALUE").length, protectedCases: protectedCaseIds.size, protectedDecisions: sumCapacity("protectedDecisions"), protectedContactsAvoided: sumCapacity("protectedContactActions") },
    capacity: { contactBudget, contactConsumed, contactDeferredEligible: sumCapacity("contactDeferredEligible"), contactUtilization: contactBudget ? contactConsumed / contactBudget : 0, humanReviewBudget: reviewBudget, humanReviewConsumed: reviewConsumed, humanReviewDeferredEligible: sumCapacity("humanReviewDeferredEligible"), humanReviewUtilization: reviewBudget ? reviewConsumed / reviewBudget : 0, capacitySelected: count("CAPACITY_SELECTED"), capacityDeferred: count("CAPACITY_DEFERRED") },
    efficiency: { interventionsPerFullRecovery: full.length ? contacts / full.length : 0, recoveredPaisePerContact: contacts ? recovered / contacts : 0, averageDaysToRecovery: recoveryDays.length ? recoveryDays.reduce((a, b) => a + b, 0) / recoveryDays.length : 0 },
    reconciliation: { endingOutstandingPaise: ending, expectedEndingOutstandingPaise: starting - recovered, valid: ending === starting - recovered && recovered <= starting },
  };
}

export function formatTimeline(result: SimulationResult, caseId: string): string {
  const c = result.finalCases.find((item) => item.id === caseId);
  if (!c) return `Case ${caseId} not found.`;
  return [`# Synthetic timeline: ${caseId}`, `Final state: ${c.state}; outstanding: ${c.outstandingPaise} paise`, ...result.auditEvents.filter((event) => event.caseId === caseId).map((event) => `- Day ${event.simulationDay}: **${event.type}** — ${event.reason}${event.amountPaise !== undefined ? ` (${event.amountPaise} paise)` : ""}`)].join("\n");
}
