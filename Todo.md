# Verification and reliability TODO

This file tracks only behavior that was not successfully verified end to end or did not behave as expected. It is not the general product roadmap.

## Razorpay hosted Test Mode proof

- [ ] Run the complete hosted Razorpay Test Mode flow against a public webhook endpoint.
  - Not yet verified: creating/reusing the real partial-enabled Payment Link, completing an exact ₹40,000 hosted checkout, and receiving Razorpay's signed webhook through the public tunnel.
  - What did pass: authenticated read-only Razorpay API smoke coverage and local integration tests using representative signed webhook payloads.
  - Done when: `INV-003` moves from ₹75,000 to ₹35,000 exactly once, the authoritative ₹35,000 remainder promise becomes active, `INV-003` becomes `WAIT_PROTECTED`, and the next eligible case is promoted to `ACT_NOW`. Retain the Payment Link, payment, event, and case identifiers as demo evidence.

## OpenRouter privacy routing

- [ ] Re-test live inference on an eligible Zero Data Retention route.
  - The ZDR-preferred smoke found no eligible provider route. The request succeeded only after the bounded fallback to `data_collection: deny`.
  - Done when: the pinned model completes a strict structured-output request through a ZDR-compatible route, or the UI and demo script explicitly present `data_collection: deny` as the available privacy posture rather than implying ZDR was verified.

## Commitment corpus failures

- [ ] Fix and re-run the `mixed-partial-remainder` case.
  - The model found the intended ₹40,000 partial payment, Friday remainder, and invoice-verification signal, but returned incorrect character spans for the verification/dispute evidence. Local validation rejected it as ungrounded.
  - Done when: the output passes exact-quote span validation and still requires deterministic human approval.

- [ ] Fix and re-run the `ambiguous-friday` case.
  - The model selected `promise_amount_mode: REMAINDER` but returned no promise date. Local validation correctly rejected the conflicting fields with `PROMISE_DATE_REQUIRED`.
  - Done when: the model resolves Friday to 2026-09-11 for the frozen timestamp, or returns a fully consistent unclear/manual-review proposal.

- [ ] Investigate and re-run the `two-amounts` case.
  - The live evaluation ended with `OpenRouterError`; no validated decision was produced for "₹20,000 today, then ₹55,000 on Tuesday."
  - Done when: the result consistently validates as a ₹20,000 pay-now proposal with the staged Tuesday commitment, or fails closed with a specific recorded failure classification instead of the generic error.

- [ ] Separate prompt-injection blocking from schema failures in evaluation reporting.
  - `prompt-injection` is intentionally blocked before model execution, but the scorer currently treats its missing model output as a schema failure and the frozen results omit an explicit blocked record.
  - Done when: the artifact records a distinct preflight-blocked outcome and reports it separately from provider, schema, and invariant failures.

- [ ] Re-run and freeze the full corpus after the fixes.
  - Current measured model results are 66.7% for intent, amount, date, dispute recall, and evidence grounding, with a 33.3% schema/invariant failure rate. Post-policy unsafe-action rate remained 0%.
  - Done when: all 12 cases have an explicit frozen outcome, safety remains at 0% unsafe post-policy actions, and remaining failures are accurately classified and disclosed.
