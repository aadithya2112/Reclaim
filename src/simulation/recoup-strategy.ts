import type {
  DecisionFactor,
  ObservableRecoveryContext,
  RecoveryAction,
  RecoveryDecision,
  RecoveryStrategy,
} from "./types";

export const RECOUP_STRATEGY_VERSION = "recoup-observable-heuristic-1.0.0";

const terminalStates = new Set(["DISPUTED", "ESCALATED", "RECOVERED", "CLOSED"]);
const rounded = (value: number) => Math.round(value * 100) / 100;

function factor(
  signal: string,
  value: string | number | boolean,
  effect: DecisionFactor["effect"],
  explanation: string,
): DecisionFactor {
  return { signal, value, effect, explanation };
}

function proposal(
  action: RecoveryAction,
  reason: string,
  confidence: number,
  factors: DecisionFactor[],
  priorityScore: number,
  avoidsContact = false,
): RecoveryDecision {
  return {
    action,
    reason,
    confidence: rounded(Math.min(1, Math.max(0, confidence))),
    factors,
    strategyVersion: RECOUP_STRATEGY_VERSION,
    inferenceMode: "DETERMINISTIC_KEYLESS",
    metadata: {
      priorityScore: rounded(priorityScore),
      avoidsContact,
      evidenceBoundary: "OBSERVABLE_SYNTHETIC_CASE_FACTS_ONLY",
      calibratedProbability: false,
      externalModelInvoked: false,
    },
  };
}

/**
 * Keyless milestone-five decision model. It behaves like a frozen, inspectable
 * model adapter: only observable case facts enter the decision and deterministic
 * policy still has final authority. Scores rank work; they are not probabilities.
 */
export class RecoupHybridStrategy implements RecoveryStrategy {
  readonly name = "recoup-hybrid" as const;

  decide(c: ObservableRecoveryContext): RecoveryDecision {
    const activePromise = c.promises.find((item) => item.status === "ACTIVE" && item.dueDay >= c.simulationDay);
    const brokenPromise = c.promises.find((item) => item.status === "BROKEN");
    const fulfilledRatio = c.history.priorPromises
      ? Math.min(1, c.history.priorPromisesFulfilled / c.history.priorPromises)
      : 0;
    const lateRatio = Math.min(1, c.history.historicalLatePayments / Math.max(1, c.history.historicalInvoices));
    const amountWeight = Math.min(30, Math.log10(Math.max(10, c.outstandingPaise)) * 5);
    const overdueWeight = Math.min(25, c.daysOverdue * .35);
    const historyWeight = fulfilledRatio * 12 + (1 - lateRatio) * 8;
    const riskPenalty = c.history.riskSegment === "HIGH" ? 18 : c.history.riskSegment === "MEDIUM" ? 5 : 0;
    const disputePenalty = Math.min(18, c.history.priorDisputes * 7);
    const fatiguePenalty = Math.min(15, c.contactAttempts * 3);
    const priorityScore = Math.max(0, Math.min(100, amountWeight + overdueWeight + historyWeight - riskPenalty - disputePenalty - fatiguePenalty));
    const commonFactors = [
      factor("outstanding_paise", c.outstandingPaise, "SUPPORTS_ACTION", "More money outstanding increases the value of scarce recovery capacity."),
      factor("days_overdue", c.daysOverdue, c.daysOverdue > 15 ? "SUPPORTS_ACTION" : "SUPPORTS_WAIT", "Overdue age changes urgency without revealing hidden customer behavior."),
      factor("risk_segment", c.history.riskSegment, c.history.riskSegment === "HIGH" ? "SUPPORTS_WAIT" : "SUPPORTS_ACTION", "The observable finance risk segment tempers automated contact."),
      factor("prior_disputes", c.history.priorDisputes, c.history.priorDisputes ? "REQUIRES_REVIEW" : "SUPPORTS_ACTION", "Visible dispute history raises relationship and compliance risk."),
      factor("contact_attempts", c.contactAttempts, c.contactAttempts >= 3 ? "SUPPORTS_WAIT" : "SUPPORTS_ACTION", "Repeated attempts reduce the value of another automated contact."),
    ];

    if (c.outstandingPaise === 0 || terminalStates.has(c.state)) {
      return proposal("WAIT", "The case is paid or terminal, so Recoup proposes no intervention.", 1, [factor("case_state", c.state, "SUPPORTS_WAIT", "Terminal financial and workflow states stop recovery activity.")], 0);
    }
    if (activePromise) {
      return proposal("WAIT", `Protect the active promise through simulation day ${activePromise.dueDay}.`, .99, [factor("active_promise_due_day", activePromise.dueDay, "SUPPORTS_WAIT", "Contact before the promise due date would be unnecessary and relationship-sensitive.")], priorityScore, true);
    }
    if (brokenPromise) {
      return proposal("FOLLOW_UP_PROMISE", "A visible promise is broken; a targeted follow-up has priority over a generic reminder.", .94, [factor("broken_promise", true, "SUPPORTS_ACTION", "The promised due date passed without fulfillment."), ...commonFactors], priorityScore + 25);
    }
    if (c.history.priorDisputes >= 2) {
      return proposal("ESCALATE_TO_HUMAN", "Repeated visible dispute history requires human review before further collection.", .96, [factor("prior_disputes", c.history.priorDisputes, "REQUIRES_REVIEW", "Repeated disputes make automated collection unsafe."), ...commonFactors.filter((item) => item.signal !== "prior_disputes")], priorityScore + 15);
    }
    if (c.history.riskSegment === "HIGH" && c.contactAttempts >= 2) {
      return proposal("ESCALATE_TO_HUMAN", "A high-risk case with repeated unsuccessful contact requires human judgment.", .9, [factor("high_risk_repeated_contact", true, "REQUIRES_REVIEW", "The combination is not eligible for another model-selected contact."), ...commonFactors], priorityScore + 10);
    }
    if (priorityScore < 30 && c.daysOverdue <= 15) {
      return proposal("WAIT", "Estimated intervention priority is below the frozen action threshold; preserve today's contact capacity.", .78, [...commonFactors, factor("priority_score", rounded(priorityScore), "SUPPORTS_WAIT", "This frozen heuristic rank is below 30; it is not a payment probability.")], priorityScore, true);
    }

    let action: RecoveryAction;
    let reason: string;
    if (c.state === "PARTIALLY_PAID") {
      action = "SEND_PAYMENT_LINK";
      reason = "A verified partial balance is visible; offer a direct path to complete payment.";
    } else if (c.daysOverdue >= 31 || (c.history.priorPromises > 0 && fulfilledRatio >= .5)) {
      action = "REQUEST_PAYMENT_COMMITMENT";
      reason = "The observable history supports asking for a dated commitment instead of repeating a generic reminder.";
    } else if (c.daysOverdue >= 12) {
      action = "SEND_PAYMENT_LINK";
      reason = "The case is materially overdue and eligible for a direct collection path.";
    } else {
      action = "SEND_GENTLE_REMINDER";
      reason = "The case is recently overdue; use the least forceful eligible intervention.";
    }
    return proposal(action, reason, .7 + Math.min(.22, priorityScore / 500), [...commonFactors, factor("priority_score", rounded(priorityScore), "SUPPORTS_ACTION", "This frozen observable-only score ranks scarce capacity; it is not a calibrated probability.")], priorityScore);
  }
}
