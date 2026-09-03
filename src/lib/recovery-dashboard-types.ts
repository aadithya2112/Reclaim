import type { DecisionFactor, RecoveryAction, ScenarioName, StrategyName } from "@/simulation/types";

export interface RecoveryDashboardControls {
  scenario: ScenarioName;
  dailyContactLimit: number;
  dailyHumanReviewLimit: number;
}

export interface RecoveryStrategySummary {
  strategy: StrategyName;
  label: string;
  simulatedRecoveredPaise: number;
  simulatedRecoveryRate: number;
  simulatedDifferenceVsNativePaise: number;
  contacts: number;
  humanReviews: number;
  protectedContacts: number;
  fullyRecoveredCases: number;
}

export interface RecoveryFrontierPoint {
  strategy: StrategyName;
  dailyContactLimit: number;
  dailyHumanReviewLimit: number;
  contacts: number;
  humanReviews: number;
  simulatedRecoveredPaise: number;
  simulatedRecoveryRate: number;
}

export interface RecoveryQueueCase {
  id: string;
  invoiceId: string;
  outstandingPaise: number;
  daysOverdue: number;
  riskSegment: "LOW" | "MEDIUM" | "HIGH";
  queue: "ACT_NOW" | "WAIT_PROTECTED" | "DEFERRED";
  proposedAction: RecoveryAction;
  executedAction: RecoveryAction;
  reason: string;
  policyReason: string;
  policyRule?: string;
  priorityScore?: number;
  confidence?: number;
  factors: DecisionFactor[];
  selected: boolean;
  timeline: Array<{ day: number; type: string; reason: string; action?: RecoveryAction; amountPaise?: number }>;
  nativeBaseline: {
    proposedAction: RecoveryAction;
    reason: string;
    recoupRecoveredPaise: number;
    nativeRecoveredPaise: number;
    simulatedDifferencePaise: number;
  };
}

export interface RecoveryDashboardData {
  evidenceLabel: "SYNTHETIC_DEVELOPMENT_BENCHMARK";
  limitation: string;
  controls: RecoveryDashboardControls;
  portfolio: {
    cases: number;
    virtualDays: number;
    startingOutstandingPaise: number;
    bankHash: string;
    evaluationSet: "development";
    seed: number;
  };
  strategies: RecoveryStrategySummary[];
  frontier: RecoveryFrontierPoint[];
  queues: {
    actNow: RecoveryQueueCase[];
    protected: RecoveryQueueCase[];
    deferred: RecoveryQueueCase[];
  };
  dailyCapacity: {
    contactsUsed: number;
    contactLimit: number;
    reviewsUsed: number;
    reviewLimit: number;
    protectedDecisions: number;
  };
  developmentRange: {
    seeds: number[];
    recoupRecoveredPaise: { minimum: number; maximum: number };
    nativeRecoveredPaise: { minimum: number; maximum: number };
    simulatedDifferencePaise: { minimum: number; maximum: number };
  };
  evidence: {
    decisionCacheHash: string;
    outcomeBankHash: string;
    scenarioVersion: string;
    externalModelInvoked: false;
    razorpayInvoked: false;
  };
}
