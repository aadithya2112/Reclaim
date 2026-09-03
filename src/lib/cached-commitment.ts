import { type CommitmentContext, type CommitmentProposal, resolveRelativeDate, validateCommitmentProposal } from "@/lib/commitment-interpreter";

export const DEMO_MESSAGE = "Sir, ₹40,000 aaj kar sakte hain, balance Friday. Invoice amount bhi please verify kar dena.";

export function cachedDemoProposal(context: CommitmentContext): CommitmentProposal | null {
  if (!context.invoiceNumber.startsWith("INV-003") || context.message !== DEMO_MESSAGE) return null;
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
  return validateCommitmentProposal(proposal, context).success ? proposal : null;
}
