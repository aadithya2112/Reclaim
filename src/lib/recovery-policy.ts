import type { CommitmentProposal } from "@/lib/commitment-interpreter";

export const OPERATIONAL_POLICY_VERSION = "operational-policy-v1.0.0";
export const HIGH_VALUE_THRESHOLD_PAISE = 5_000_000;
export const LOW_CONFIDENCE_THRESHOLD = 0.8;

export type OperationalPolicyResult = {
  outcome: "AUTO_ELIGIBLE" | "APPROVAL_REQUIRED" | "BLOCKED";
  reasons: string[];
};

export function evaluateOperationalPolicy(proposal: CommitmentProposal, context: { outstandingPaise: number; status: "OPEN" | "PARTIALLY_PAID" | "RECOVERED" }): OperationalPolicyResult {
  const reasons: string[] = [];
  if (context.status === "RECOVERED" || context.outstandingPaise <= 0) return { outcome: "BLOCKED", reasons: ["TERMINAL_OR_ZERO_BALANCE"] };
  if (["CLOSE_CASE", "VERIFY_PAYMENT_STATE"].includes(proposal.proposed_action)) return { outcome: "BLOCKED", reasons: ["ACTION_CANNOT_BE_AUTHORIZED_FROM_CUSTOMER_TEXT"] };
  if (proposal.pay_now_paise !== null && proposal.pay_now_paise > context.outstandingPaise) return { outcome: "BLOCKED", reasons: ["AMOUNT_EXCEEDS_AUTHORITATIVE_OUTSTANDING"] };
  if (proposal.intent === "PARTIAL_PAYMENT_AND_PROMISE" || proposal.proposed_action === "OFFER_PARTIAL_PAYMENT") reasons.push("PARTIAL_PAYMENT");
  if (proposal.dispute_signal !== "NONE" || proposal.invoice_verification_requested) reasons.push("DISPUTE_OR_AMBIGUITY");
  if (context.outstandingPaise >= HIGH_VALUE_THRESHOLD_PAISE) reasons.push("HIGH_VALUE");
  if (proposal.confidence < LOW_CONFIDENCE_THRESHOLD) reasons.push("LOW_CONFIDENCE");
  if (proposal.intent === "DISPUTE_OR_VERIFY" && !["ESCALATE_DISPUTE", "ESCALATE_TO_HUMAN"].includes(proposal.proposed_action)) reasons.push("CONFLICTING_FIELDS");
  return reasons.length ? { outcome: "APPROVAL_REQUIRED", reasons } : { outcome: "AUTO_ELIGIBLE", reasons: ["BOUNDED_LOW_RISK_ACTION"] };
}
