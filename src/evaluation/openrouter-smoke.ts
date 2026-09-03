import { DEMO_MESSAGE } from "@/lib/cached-commitment";
import { BUSINESS_TIMEZONE, stableHash, validateCommitmentProposal, type CommitmentContext } from "@/lib/commitment-interpreter";
import { interpretWithOpenRouter, OPENROUTER_MODEL } from "@/lib/openrouter";

const context: CommitmentContext = { recoveryCaseId: "smoke-only", invoiceNumber: "INV-003", amountDuePaise: 7_500_000, amountRecoveredPaise: 0, currency: "INR", message: DEMO_MESSAGE, messageReceivedAt: "2026-09-03T10:00:00+05:30", businessTimezone: BUSINESS_TIMEZONE };
const result = await interpretWithOpenRouter(context);
const validated = validateCommitmentProposal(result.output, context);
if (!validated.success) throw new Error(`Authenticated output failed local validation: ${validated.reasons.join(", ")}`);
console.log(JSON.stringify({ authenticated: true, model: OPENROUTER_MODEL, provider: result.provider, privacyMode: result.privacyMode, fallbackReason: result.fallbackReason, latencyMs: result.latencyMs, inputHash: stableHash(context), outputHash: stableHash(validated.data), intent: validated.data.intent, payNowPaise: validated.data.pay_now_paise, promisedDate: validated.data.promised_date, disputeSignal: validated.data.dispute_signal }, null, 2));
