import { type CommitmentContext, type CommitmentProposal, resolveRelativeDate, validateCommitmentProposal } from "@/lib/commitment-interpreter";

export const DEMO_MESSAGE = "Sir, ₹40,000 aaj kar sakte hain, balance Friday. Invoice amount bhi please verify kar dena.";
export const DEMO_RECEIVED_AT = "2026-09-03T10:00:00+05:30";
export const CACHED_COMMITMENT_VERSION = "inv-003-cache-v2";

export function cachedDemoProposal(context: CommitmentContext): CommitmentProposal | null {
  if (
    !context.invoiceNumber.startsWith("INV-003") ||
    context.message !== DEMO_MESSAGE ||
    context.amountDuePaise !== 7_500_000 ||
    context.amountRecoveredPaise !== 0 ||
    context.currency !== "INR" ||
    context.businessTimezone !== "Asia/Kolkata" ||
    new Date(context.messageReceivedAt).getTime() !== new Date(DEMO_RECEIVED_AT).getTime()
  ) return null;
  const quote = (field: CommitmentProposal["evidence"][number]["field"], value: string) => {
    const start = context.message.indexOf(value);
    return { field, quote: value, start, end: start + value.length };
  };
  const proposal: CommitmentProposal = {
    intent: "PARTIAL_PAYMENT_AND_PROMISE",
    pay_now_paise: 4_000_000,
    promise_amount_mode: "REMAINDER",
    explicit_promised_amount_paise: null,
    promised_date: resolveRelativeDate("Friday", context.messageReceivedAt, context.businessTimezone),
    invoice_verification_requested: true,
    dispute_signal: "POSSIBLE",
    confidence: 0.91,
    proposed_action: "OFFER_PARTIAL_PAYMENT",
    evidence: [
      quote("intent", "₹40,000 aaj kar sakte hain, balance Friday"),
      quote("pay_now_paise", "₹40,000 aaj"),
      quote("promise_amount_mode", "balance Friday"),
      quote("promised_date", "balance Friday"),
      quote("invoice_verification_requested", "Invoice amount bhi please verify kar dena"),
      quote("dispute_signal", "please verify"),
      quote("proposed_action", "₹40,000 aaj kar sakte hain"),
    ],
  };
  const validated = validateCommitmentProposal(proposal, context);
  return validated.success ? validated.data : null;
}
