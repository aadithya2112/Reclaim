# Verification and reliability TODO

This file tracks only behavior that is not successfully verified end to end or remains a disclosed external limitation. It is not the general product roadmap.

## Remaining: Razorpay hosted Test Mode proof

- [ ] In a later user-assisted session, run the complete hosted Razorpay Test Mode flow against a public webhook endpoint.
  - Still not verified: creating/reusing the real partial-enabled Payment Link, completing an exact ₹40,000 hosted checkout, and receiving Razorpay's signed webhook through the public tunnel.
  - What is verified: authenticated read-only Razorpay Test Mode API access; local database integration using representative signed `payment_link.partially_paid` and `payment_link.paid` payloads; duplicate and out-of-order protection.
  - Done when: `INV-003` moves from ₹75,000 to ₹35,000 exactly once, the authoritative ₹35,000 remainder promise becomes active, `INV-003` becomes `WAIT_PROTECTED`, and `INV-001` is promoted to `ACT_NOW`. Retain the Payment Link, payment, event, and case identifiers as Test Mode evidence.
  - Do not substitute the recorded fallback for this acceptance proof. The fallback is explicitly simulated and writes no ledger state.

## Completed reliability work

- [x] Re-tested OpenRouter ZDR preference and disclosed the available privacy posture.
  - On 2026-09-03 the pinned strict-output smoke again found no eligible ZDR route.
  - The bounded fallback succeeded through OpenAI with `data_collection: deny`; the operational replay persists and displays `DATA COLLECTION: DENY` rather than implying ZDR was verified.
  - ZDR remains a non-blocking preference, not a product or safety claim.

- [x] Fixed and re-ran `mixed-partial-remainder`.
  - Unique exact quotes are canonicalized to their actual source spans before validation and freezing.
  - The final measured output validates as ₹40,000 now, `REMAINDER`, Friday 2026-09-04, and a possible invoice-verification signal; deterministic policy still requires approval.
  - Numeric promises now require evidence containing the exact numeric amount, so the model cannot infer an explicit number from “balance” or “rest.”

- [x] Fixed and re-ran `ambiguous-friday`.
  - The prompt and deterministic validator use the same rule: a named weekday is the next occurrence strictly after the local message date.
  - The final measured output resolves Friday from Friday 2026-09-04 to 2026-09-11 and remains low-confidence/manual-review.

- [x] Fixed and re-ran `two-amounts`.
  - The final measured output validates as ₹20,000 now plus an explicit ₹55,000 promise on Tuesday 2026-09-08.
  - Provider failures now retain their typed code and HTTP status rather than collapsing to `OpenRouterError`; this run had no provider failure.

- [x] Separated prompt-injection preflight blocking from model-output failures.
  - The injection case has an explicit `PREFLIGHT_BLOCKED` record, `PROMPT_INJECTION_DETECTED`, null output/provider, and no provider call.
  - Reporting distinguishes preflight, provider, schema, and deterministic invariant outcomes.

- [x] Re-ran and froze all 12 corpus cases.
  - Artifact: `evaluation-results/commitment-english-hinglish-v1.0.0-commitment-prompt-v1.0.3-2026-09-03T17-11-07.946Z.json`.
  - Denominator: 11 provider-eligible cases; the injection preflight block is reported separately.
  - Measured model results: 9/11 validated; 72.7% intent; 81.8% pay-now amount; 81.8% promised amount; 81.8% date; 100% dispute recall; 81.8% evidence grounding; 0 provider failures; 0 schema failures; 2 deterministic invariant failures; 0% unsafe post-policy actions.
  - Residual failures are preserved, not hidden: `english-full-today` and `malformed` returned conflicting promise fields and failed closed with `PROMISE_FIELDS_CONFLICT`.
