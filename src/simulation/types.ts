export const SIMULATOR_VERSION = "3.0.0";

export type RecoveryState = "OPEN" | "CONTACTED" | "PROMISED" | "PARTIALLY_PAID" | "DISPUTED" | "ESCALATED" | "RECOVERED" | "CLOSED";
export type RecoveryAction = "WAIT" | "SEND_GENTLE_REMINDER" | "SEND_PAYMENT_REMINDER" | "SEND_PAYMENT_LINK" | "REQUEST_PAYMENT_COMMITMENT" | "FOLLOW_UP_PROMISE" | "ESCALATE_TO_HUMAN" | "CLOSE_CASE";
export type Profile = "RELIABLE_LATE_PAYER" | "CASHFLOW_CONSTRAINED" | "LOW_RESPONSIVENESS" | "DISPUTE_PRONE" | "HIGH_RISK";
export type PromiseStatus = "ACTIVE" | "FULFILLED" | "PARTIALLY_FULFILLED" | "BROKEN" | "CANCELLED";
export type StrategyName = "finance-age-bucket" | "razorpay-native-reminders" | "no-intervention";
export type CapacityKind = "CONTACT" | "HUMAN_REVIEW";
export type ScenarioName = "conservative" | "standard" | "adversarial" | "relationship-sensitive";
export type EvaluationSetName = "development" | "held-out" | "custom";

export interface PromiseToPay { id: string; createdDay: number; contactAttemptsAtCreation?: number; amountPaise: number; dueDay: number; status: PromiseStatus; amountFulfilledPaise: number; paymentIds: string[] }
export interface ObservableHistory { historicalInvoices: number; historicalLatePayments: number; priorPromises: number; priorPromisesFulfilled: number; priorDisputes: number; riskSegment: "LOW" | "MEDIUM" | "HIGH" }
export interface SimulationCase {
  id: string; customerId: string; invoiceId: string; originalAmountPaise: number; startingOutstandingPaise: number; outstandingPaise: number; recoveredPaise: number;
  invoiceIssueDate: string; dueDate: string; initialDaysOverdue: number; state: RecoveryState; contactAttempts: number; lastContactDay: number | null;
  history: ObservableHistory; promises: PromiseToPay[]; dispute: boolean; escalated: boolean; closed: boolean; initialRecoveredPaise: number; recoveredDay: number | null;
}
export interface HiddenCustomerState { profile: Profile; responsiveness: number; paymentAbility: number; willingness: number; disputePropensity: number; promiseReliability: number; partialTendency: number; spontaneousPayment: number }
export interface ObservableRecoveryContext extends Omit<SimulationCase, "initialDaysOverdue"> { simulationDay: number; daysOverdue: number }
export interface RecoveryDecision { action: RecoveryAction; reason: string; metadata?: Record<string, unknown> }
export interface RecoveryStrategy { readonly name: StrategyName; decide(context: ObservableRecoveryContext): RecoveryDecision }
export interface PolicyResult { proposedAction: RecoveryAction; allowed: boolean; reason: string; executedAction: RecoveryAction; rule?: string }
export interface AuditEvent { eventId: string; runId: string; caseId: string; simulationDay: number; simulatedAt: string; type: string; source: "SIMULATION" | "STRATEGY" | "POLICY" | "CAPACITY"; reason: string; action?: RecoveryAction; amountPaise?: number; metadata?: Record<string, unknown> }
export interface SyntheticPaymentEvent { eventId: string; paymentId: string; caseId: string; amountPaise: number; simulationDay: number; source: "SIMULATION"; reason: string; promiseId?: string }
export interface CapacityConfig { dailyContactLimit: number; dailyHumanReviewLimit: number }
export interface SimulationConfig { seed: number; caseCount: number; days: number; startDate: string; strategy: StrategyName; scenario: ScenarioName; evaluationSet: EvaluationSetName; policy: PolicyConfig; capacity: CapacityConfig }
export interface SimulationConfigInput extends Omit<Partial<SimulationConfig>, "policy" | "capacity"> { policy?: Partial<PolicyConfig>; capacity?: Partial<CapacityConfig> }
export interface PolicyConfig { maxContactAttempts: number; cooldownDays: number; highValueThresholdPaise: number }
export interface WorkCandidate { caseId: string; action: RecoveryAction; capacityKind: CapacityKind; outstandingPaise: number; daysOverdue: number; hasBrokenPromise: boolean; contactAttempts: number }
export interface CapacityAllocation { selected: WorkCandidate[]; deferred: WorkCandidate[] }
export interface DailyCapacityRecord { simulationDay: number; contactBudget: number; contactConsumed: number; contactDeferredEligible: number; humanReviewBudget: number; humanReviewConsumed: number; humanReviewDeferredEligible: number; protectedDecisions: number; protectedContactActions: number }
export interface SimulationMetrics { portfolio: Record<string, number>; recovery: Record<string, number>; interventions: Record<string, number>; promises: Record<string, number>; safety: Record<string, number>; capacity: Record<string, number>; efficiency: Record<string, number>; reconciliation: { endingOutstandingPaise: number; expectedEndingOutstandingPaise: number; valid: boolean } }
export interface ActionPotentialOutcome { responseUnit: number; outcomeUnit: number; partialPaymentUnit: number; promiseAmountUnit: number; promiseDueUnit: number }
export interface PromisePotentialOutcome { realizationUnit: number; fullPaymentUnit: number }
export interface PotentialOutcomeBank {
  schemaVersion: "1.0.0";
  simulatorVersion: string;
  scenarioVersion: string;
  scenarioName: ScenarioName;
  normalizedConfig: Omit<SimulationConfig, "strategy">;
  caseIds: string[];
  supportedContactActions: RecoveryAction[];
  outcomes: Record<string, { spontaneousByDay: Record<string, number>; actionsByDay: Record<string, Record<string, Record<string, ActionPotentialOutcome>>>; promiseByCreation: Record<string, Record<string, PromisePotentialOutcome>> }>;
  sha256: string;
}
export interface SimulationResult { runId: string; config: SimulationConfig; initialPortfolio: SimulationCase[]; hiddenState: Record<string, HiddenCustomerState>; potentialOutcomeBankHash?: string; finalCases: SimulationCase[]; auditEvents: AuditEvent[]; payments: SyntheticPaymentEvent[]; dailyCapacity: DailyCapacityRecord[]; metrics: SimulationMetrics }
export interface StrategyComparison { comparisonId: string; evidenceLabel: "SYNTHETIC_STRATEGY_COMPARISON"; pairedOutcomeStatus: "FROZEN_PAIRED_SYNTHETIC"; limitation: string; commonConfig: Omit<SimulationConfig, "strategy">; scenarioManifest: ScenarioManifest; potentialOutcomeBank: PotentialOutcomeBank; potentialOutcomeBankHash: string; reconciliation: { valid: boolean; initialPortfoliosIdentical: boolean; hiddenStatesIdentical: boolean; bankHashesIdentical: boolean; commonInputsIdentical: boolean; caseMoneyReconciled: boolean }; results: SimulationResult[] }
export interface ScenarioManifest { schemaVersion: "1.0.0"; name: ScenarioName; version: string; description: string; assumptions: { spontaneousPaymentMultiplier: number; responsivenessMultiplier: number; paymentAbilityMultiplier: number; willingnessMultiplier: number; promiseReliabilityMultiplier: number; disputePropensityMultiplier: number; contactCostMultiplier: number; actionModifiers: Record<string, number>; relationshipRules: string }; }
