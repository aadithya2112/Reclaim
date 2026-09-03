import { compareStrategies } from "@/simulation/simulator";
import type { ScenarioName, SimulationResult, StrategyComparison, StrategyName } from "@/simulation/types";
import type {
  RecoveryDashboardControls,
  RecoveryDashboardData,
  RecoveryFrontierPoint,
  RecoveryQueueCase,
  RecoveryStrategySummary,
} from "./recovery-dashboard-types";

const STRATEGY_LABELS: Record<StrategyName, string> = {
  "recoup-hybrid": "Recoup",
  "recoup-agent": "Frozen Recoup agent",
  "razorpay-native-reminders": "Native reminders",
  "finance-age-bucket": "Finance SOP",
  "no-intervention": "No intervention",
};

const DEFAULT_CASES = 96;
const DEFAULT_DAYS = 14;
const DEVELOPMENT_SEED = 42;

export interface DashboardBuildOptions {
  caseCount?: number;
  days?: number;
  frontierContactLimits?: number[];
  developmentSeeds?: number[];
}

function strategySummary(comparison: StrategyComparison, result: SimulationResult): RecoveryStrategySummary {
  const delta = comparison.comparativeMetrics?.deltas.find((item) => item.strategy === result.config.strategy);
  return {
    strategy: result.config.strategy,
    label: STRATEGY_LABELS[result.config.strategy],
    simulatedRecoveredPaise: result.metrics.recovery.totalRecoveredPaise,
    simulatedRecoveryRate: result.metrics.recovery.recoveryRate,
    simulatedDifferenceVsNativePaise: delta?.simulatedIncrementalRecoveryPaise ?? 0,
    contacts: result.metrics.capacity.contactConsumed,
    humanReviews: result.metrics.capacity.humanReviewConsumed,
    protectedContacts: result.metrics.safety.protectedContactsAvoided,
    fullyRecoveredCases: result.metrics.recovery.fullyRecoveredCases,
  };
}

function queueCase(result: SimulationResult, native: SimulationResult, caseId: string, queue: RecoveryQueueCase["queue"]): RecoveryQueueCase {
  const initial = result.initialPortfolio.find((item) => item.id === caseId);
  const decision = result.decisionCache.entries.find((entry) => entry.caseId === caseId && entry.simulationDay === 0)?.decision;
  const nativeDecision = native.decisionCache.entries.find((entry) => entry.caseId === caseId && entry.simulationDay === 0)?.decision;
  const recoupFinal = result.finalCases.find((item) => item.id === caseId);
  const nativeFinal = native.finalCases.find((item) => item.id === caseId);
  if (!initial || !decision || !nativeDecision || !recoupFinal || !nativeFinal) throw new Error(`Missing observable dashboard decision for ${caseId}`);
  const dayZero = result.auditEvents.filter((event) => event.caseId === caseId && event.simulationDay === 0);
  const policy = dayZero.find((event) => event.type === "ACTION_ALLOWED" || event.type === "ACTION_BLOCKED");
  const capacity = dayZero.find((event) => event.type === "CAPACITY_SELECTED" || event.type === "CAPACITY_DEFERRED");
  return {
    id: initial.id,
    invoiceId: initial.invoiceId,
    outstandingPaise: initial.startingOutstandingPaise,
    daysOverdue: initial.initialDaysOverdue,
    riskSegment: initial.history.riskSegment,
    queue,
    proposedAction: decision.action,
    executedAction: policy?.action ?? decision.action,
    reason: decision.reason,
    policyReason: policy?.reason ?? "No policy event recorded.",
    policyRule: typeof policy?.metadata?.rule === "string" ? policy.metadata.rule : undefined,
    priorityScore: typeof decision.metadata?.priorityScore === "number" ? decision.metadata.priorityScore : undefined,
    confidence: decision.confidence,
    factors: decision.factors ?? [],
    selected: capacity?.type === "CAPACITY_SELECTED",
    timeline: result.auditEvents
      .filter((event) => event.caseId === caseId && ["ACTION_PROPOSED", "ACTION_BLOCKED", "ACTION_ALLOWED", "CAPACITY_SELECTED", "CAPACITY_DEFERRED", "CUSTOMER_CONTACTED", "CUSTOMER_NO_RESPONSE", "PROMISE_CREATED", "PROMISE_BROKEN", "PARTIAL_PAYMENT_RECEIVED", "CASE_RECOVERED", "DISPUTE_DETECTED", "CASE_ESCALATED"].includes(event.type))
      .slice(0, 10)
      .map((event) => ({ day: event.simulationDay, type: event.type, reason: event.reason, action: event.action, amountPaise: event.amountPaise })),
    nativeBaseline: {
      proposedAction: nativeDecision.action,
      reason: nativeDecision.reason,
      recoupRecoveredPaise: recoupFinal.recoveredPaise - recoupFinal.initialRecoveredPaise,
      nativeRecoveredPaise: nativeFinal.recoveredPaise - nativeFinal.initialRecoveredPaise,
      simulatedDifferencePaise: (recoupFinal.recoveredPaise - recoupFinal.initialRecoveredPaise) - (nativeFinal.recoveredPaise - nativeFinal.initialRecoveredPaise),
    },
  };
}

function queueIds(result: SimulationResult, queue: RecoveryQueueCase["queue"]): string[] {
  if (queue === "ACT_NOW") return result.auditEvents.filter((event) => event.simulationDay === 0 && event.type === "CAPACITY_SELECTED").map((event) => event.caseId);
  if (queue === "DEFERRED") return result.auditEvents.filter((event) => event.simulationDay === 0 && event.type === "CAPACITY_DEFERRED").map((event) => event.caseId);
  return result.auditEvents
    .filter((event) => event.simulationDay === 0 && event.type === "QUEUE_CLASSIFIED" && event.metadata?.queue === "WAIT_PROTECTED")
    .map((event) => event.caseId);
}

function frontierPoints(comparison: StrategyComparison): RecoveryFrontierPoint[] {
  return comparison.results
    .filter((result) => result.config.strategy !== "no-intervention")
    .map((result) => ({
      strategy: result.config.strategy,
      dailyContactLimit: result.config.capacity.dailyContactLimit,
      dailyHumanReviewLimit: result.config.capacity.dailyHumanReviewLimit,
      contacts: result.metrics.capacity.contactConsumed,
      humanReviews: result.metrics.capacity.humanReviewConsumed,
      simulatedRecoveredPaise: result.metrics.recovery.totalRecoveredPaise,
      simulatedRecoveryRate: result.metrics.recovery.recoveryRate,
    }));
}

export function buildRecoveryDashboard(
  controls: RecoveryDashboardControls,
  options: DashboardBuildOptions = {},
): RecoveryDashboardData {
  const caseCount = options.caseCount ?? DEFAULT_CASES;
  const days = options.days ?? DEFAULT_DAYS;
  const developmentSeeds = options.developmentSeeds ?? [42, 91, 123];
  const contactLimits = [...new Set(options.frontierContactLimits ?? [5, 10, 20, 30, controls.dailyContactLimit])].sort((a, b) => a - b);
  const comparisonFor = (dailyContactLimit: number, seed = DEVELOPMENT_SEED, strategies?: StrategyName[]) => compareStrategies({
    caseCount,
    days,
    seed,
    scenario: controls.scenario,
    evaluationSet: "development",
    capacity: { dailyContactLimit, dailyHumanReviewLimit: controls.dailyHumanReviewLimit },
  }, strategies);
  const comparisons = contactLimits.map((limit) => comparisonFor(limit));
  const selected = comparisons.find((item) => item.commonConfig.capacity.dailyContactLimit === controls.dailyContactLimit) ?? comparisonFor(controls.dailyContactLimit);
  const recoup = selected.results.find((result) => result.config.strategy === "recoup-hybrid");
  const native = selected.results.find((result) => result.config.strategy === "razorpay-native-reminders");
  if (!recoup || !native || !selected.reconciliation.valid) throw new Error("Recovery dashboard comparison did not reconcile");
  const rangeComparisons = developmentSeeds.map((seed) => seed === DEVELOPMENT_SEED ? selected : comparisonFor(controls.dailyContactLimit, seed, ["recoup-hybrid", "razorpay-native-reminders"]));
  if (rangeComparisons.some((item) => !item.reconciliation.valid)) throw new Error("Development range comparison did not reconcile");
  const rangeValues = rangeComparisons.map((comparison) => {
    const recoupResult = comparison.results.find((result) => result.config.strategy === "recoup-hybrid")!;
    const nativeResult = comparison.results.find((result) => result.config.strategy === "razorpay-native-reminders")!;
    return { recoup: recoupResult.metrics.recovery.totalRecoveredPaise, native: nativeResult.metrics.recovery.totalRecoveredPaise };
  });
  const range = (values: number[]) => ({ minimum: Math.min(...values), maximum: Math.max(...values) });
  const dayZero = recoup.dailyCapacity[0];
  const takeCases = (queue: RecoveryQueueCase["queue"], limit: number) => queueIds(recoup, queue).slice(0, limit).map((caseId) => queueCase(recoup, native, caseId, queue));
  return {
    evidenceLabel: "SYNTHETIC_DEVELOPMENT_BENCHMARK",
    limitation: "Paired synthetic differences under disclosed assumptions; not real merchant recovery, calibrated probability, or causal uplift.",
    controls,
    portfolio: {
      cases: caseCount,
      virtualDays: days,
      startingOutstandingPaise: recoup.metrics.portfolio.totalStartingOutstandingPaise,
      bankHash: selected.potentialOutcomeBankHash,
      evaluationSet: "development",
      seed: DEVELOPMENT_SEED,
    },
    strategies: selected.results.map((result) => strategySummary(selected, result)),
    frontier: comparisons.flatMap(frontierPoints),
    queues: {
      actNow: takeCases("ACT_NOW", 8),
      protected: takeCases("WAIT_PROTECTED", 8),
      deferred: takeCases("DEFERRED", 8),
    },
    dailyCapacity: {
      contactsUsed: dayZero.contactConsumed,
      contactLimit: dayZero.contactBudget,
      reviewsUsed: dayZero.humanReviewConsumed,
      reviewLimit: dayZero.humanReviewBudget,
      protectedDecisions: dayZero.protectedDecisions,
    },
    developmentRange: {
      seeds: developmentSeeds,
      recoupRecoveredPaise: range(rangeValues.map((item) => item.recoup)),
      nativeRecoveredPaise: range(rangeValues.map((item) => item.native)),
      simulatedDifferencePaise: range(rangeValues.map((item) => item.recoup - item.native)),
    },
    evidence: {
      decisionCacheHash: recoup.decisionCache.sha256,
      outcomeBankHash: selected.potentialOutcomeBankHash,
      scenarioVersion: selected.scenarioManifest.version,
      externalModelInvoked: false,
      razorpayInvoked: false,
    },
  };
}

const dashboardCache = new Map<string, RecoveryDashboardData>();

export function cachedRecoveryDashboard(controls: RecoveryDashboardControls): RecoveryDashboardData {
  const key = `${controls.scenario}:${controls.dailyContactLimit}:${controls.dailyHumanReviewLimit}`;
  const cached = dashboardCache.get(key);
  if (cached) return structuredClone(cached);
  const result = buildRecoveryDashboard(controls);
  dashboardCache.set(key, result);
  return structuredClone(result);
}

export const DASHBOARD_SCENARIOS: ScenarioName[] = ["standard", "conservative", "adversarial", "relationship-sensitive"];
