# Recoup: Research-Informed Winning Plan

Last revised: 2026-09-03

Status: Canonical product and demo plan

Research basis: [Razorpay capabilities relevant to AI Revenue Recovery](../research/razorpay-revenue-recovery-existing-features.md)

## 1. Executive decision

Recoup will be an **intervention-vs-wait recovery agent for overdue B2B receivables**.

It will not compete with Razorpay's native reminders, retries, routing, dashboards, hosted collection, or reconciliation. Instead, it will decide:

- which receivable deserves scarce recovery attention now;
- whether acting now is likely to add value over waiting or native automation;
- which bounded intervention is appropriate;
- when a promise, dispute, late authorization, or verified payment requires silence;
- when a concession or high-value case requires human approval; and
- how a verified Razorpay payment changes the recovery plan and portfolio priority.

The product promise is:

> Recoup finds the next best recovery action—including deliberate inaction—executes it through Razorpay, and proves the verified and simulated impact without overstating either.

The winning demo has two connected moments:

1. A **Recovery Frontier** shows how Recoup allocates a limited contact budget more effectively than Razorpay-native reminders and a fixed finance-team schedule across the same synthetic portfolio.
2. A live ambiguous English/Hinglish customer response becomes a policy-approved partial-payment and promise plan, followed by a verified Razorpay Test Mode payment and immediate portfolio reallocation.

## 2. What the Razorpay research changed

The original direction correctly emphasized state, policy, simulation, audit, and promises. It still risked presenting capabilities Razorpay already supplies as product innovation.

Razorpay already provides:

- Payment Link and Invoice reminders and notifications;
- Payment Link and Invoice partial payments;
- automatic Subscription retries, customer notifications, and pending/halted states;
- payment-failure metadata and retry attempts;
- late-authorization processing;
- Magic Checkout abandonment data and reports;
- Optimizer routing and gateway-success optimization;
- Smart Collect bank-transfer reconciliation;
- payment and failure dashboards; and
- signed financial webhooks and fetch APIs.

Therefore:

- “Generate a link” is an execution primitive, not the pitch.
- “Send a reminder” is not differentiation.
- “Retry a failed subscription” would duplicate native behavior.
- “Detect payment degradation” would overlap with Checkout and Optimizer.
- “Show failed payments in a dashboard” would resemble Razorpay's Dashboard.
- “Track promises” is valuable but is already an example direction in the track and is not enough alone.
- “Cross-product recovery control plane” is a credible long-term vision, but implementing many Razorpay products would weaken hackathon focus.

The narrow opportunity Razorpay does not publicly document as a single product is the decision and evidence layer around those primitives: business-context recovery cases, intervention-vs-wait prioritization, promises and disputes, bounded policy, scarce-capacity allocation, human review, attribution, and an auditable AI timeline.

## 3. Product thesis

Finance teams do not merely need another reminder. They need to know where intervention will add the most cash beyond what would happen anyway.

Recoup treats **WAIT** as a first-class action. Waiting can be correct when:

- a customer has an active promise-to-pay;
- a payment may be late-authorized;
- a Razorpay-native retry remains active;
- a verified payment event is pending reconciliation;
- a dispute requires review;
- a recent contact is still inside cooldown; or
- the expected benefit of another contact is lower than using that limited contact elsewhere.

This gives the agent a defensible recovery objective:

~~~text
incremental value of acting now
= expected recovery after selected intervention
− expected recovery from waiting or native automation
− contact and relationship cost
− policy and compliance risk
~~~

Until real merchant outcome data exists, Recoup must describe these values as scenario estimates or synthetic evaluation outputs—not calibrated real-world probabilities.

## 4. The core recovery loop

~~~text
Overdue receivable and observable history
              ↓
AI interprets notes, replies, and payment context
              ↓
Candidate action and recovery factors
              ↓
Deterministic policy filters or escalates
              ↓
Capacity allocator compares ACT NOW versus WAIT
              ↓
Bounded action through a Razorpay primitive
              ↓
Customer response or verified Razorpay event
              ↓
Case, promise, balance, and queue update
              ↓
Measured decision outcome and audit replay
~~~

Every recovery event must connect:

> observation → AI proposal → policy result → execution → customer or payment event → case update → attributed outcome

## 5. The standout portfolio experience: Recovery Frontier

The existing Recovery Time Machine becomes a more defensible **Recovery Frontier**.

The judge sees the same receivables evaluated under:

1. **Razorpay-native baseline:** create the standard collection primitive and use its fixed/native reminders without Recoup case intelligence.
2. **Finance-team baseline:** use an overdue-age schedule such as gentle reminder, stronger reminder, link, then escalation.
3. **Recoup:** choose ACT, WAIT, partial-payment offer, commitment request, or human escalation under the same capacity and policy.

The main visualization plots:

- horizontal axis: customer contacts or human-review load;
- vertical axis: simulated recovered rupees;
- separate lines or points for native baseline, fixed finance rules, and Recoup;
- a visible selected daily contact budget;
- a scenario selector for conservative, standard, and adversarial assumptions; and
- an uncertainty band or result range across held-out seeds.

The point is not merely “our bar is taller.” The judge should be able to move the contact budget and see:

- which cases enter or leave today's queue;
- which cases are protected from contact;
- why Recoup expects action to add value;
- how much simulated recovery changes;
- how customer burden changes; and
- which case-level decisions account for the difference.

The headline should use a range when appropriate:

> Across held-out synthetic scenarios, Recoup produced ₹A–₹B more simulated recovery than the native-reminder baseline at the same contact budget.

This is harder to dismiss than one tuned result from one simulator seed.

## 6. The memorable live case

Use one imported overdue receivable with a messy response:

> “Sir, ₹40,000 aaj kar sakte hain, balance Friday. Invoice amount bhi please verify kar dena.”

The agent creates a structured proposal:

~~~json
{
  "intent": "PARTIAL_PAYMENT_AND_PROMISE",
  "pay_now_paise": 4000000,
  "promise_amount_mode": "REMAINDER",
  "explicit_promised_amount_paise": null,
  "promised_date": "2026-09-04",
  "invoice_verification_requested": true,
  "dispute_signal": "POSSIBLE",
  "confidence": 0.91,
  "proposed_action": "OFFER_PARTIAL_PAYMENT",
  "evidence": [
    { "field": "pay_now_paise", "quote": "₹40,000 aaj" },
    { "field": "promised_date", "quote": "balance Friday" },
    { "field": "invoice_verification_requested", "quote": "Invoice amount bhi please verify kar dena" }
  ]
}
~~~

The operational fixture `INV-003` is ₹75,000. The model may identify that the customer offered ₹40,000 and promised the remainder, but it must not calculate or assert the authoritative remainder. After a verified ₹40,000 webhook, deterministic application arithmetic establishes the remaining promise as ₹35,000.

The demo sequence is:

1. AI extracts intent, amount, date, and ambiguity.
2. Policy refuses fully autonomous execution because of the possible dispute.
3. A human approves the safe partial-payment action while routing the invoice query for review.
4. Recoup creates a Razorpay Test Mode Standard Payment Link with partial payment enabled and stable case correlation.
5. The customer completes the partial payment on Razorpay-hosted Checkout.
6. A verified and deduplicated payment_link.partially_paid event records the payment exactly once.
7. The outstanding balance becomes a protected dated promise.
8. The customer disappears from today's contact queue.
9. The freed contact slot is visibly reallocated to the next highest-value eligible case.
10. The audit replay shows why each system component acted.

Step 9 is important: promise protection now has visible portfolio value. It avoids unnecessary contact and reallocates scarce recovery capacity instead of being only a status change.

The live demo sentence is:

> AI interprets and proposes. Policy authorizes. Razorpay verifies the money. Recoup reallocates the next recovery action.

## 7. What makes the AI necessary

AI should handle information that fixed rules cannot reliably structure:

- ambiguous English/Hinglish customer replies;
- payment intent, proposed dates, partial amounts, and requests for time;
- dispute or relationship-risk signals in collections notes;
- synthesis of invoice aging, prior contact, promises, and verified failure context;
- a case-level next-action proposal with structured supporting factors; and
- a concise explanation tied only to facts visible at decision time.

AI must not:

- declare a payment successful;
- set the authoritative amount due;
- bypass cooldown, dispute, promise, or approval rules;
- invent an available payment method;
- route across gateways;
- approve credit or financing;
- cancel, capture, refund, or settle money autonomously; or
- use hidden simulator traits.

The first batch agent can use cached, schema-validated model decisions for reproducibility. The live case should call the model directly and show validation and policy gating.

### Live model contract

Milestone 8 should use OpenRouter with the pinned `openai/gpt-5-mini` model. OpenRouter documents JSON Schema structured outputs for this model. Send requests through the documented Chat Completions `response_format` contract with `strict: true`, `additionalProperties: false`, and provider routing configured with `require_parameters: true`. Prefer `data_collection: "deny"` and `zdr: true` when an eligible route is available.

The model receives only a canonical server-built snapshot of observable case facts, the message timestamp, the `Asia/Kolkata` business timezone, and the untrusted customer message/collection note. It receives no tools, credentials, hidden simulator state, potential outcomes, future events, or authority to mutate application state.

Every response must pass both JSON Schema/Zod validation and deterministic business invariants:

- money is positive integer paise and cannot exceed authoritative outstanding;
- relative dates resolve from the supplied message timestamp and timezone;
- quoted evidence must be an exact substring of an input field;
- a remainder is calculated only from verified application state;
- dispute, ambiguity, partial-payment, concession, and high-value cases require human approval; and
- the action allowlist cannot express payment success, credit approval, refunds, capture, settlement, or arbitrary tool execution.

Malformed output, refusal, timeout, rate limiting, or provider failure must fail closed into manual review. At most one bounded retry is allowed for a transient failure. The demo fallback is a pre-generated, schema-validated decision labelled **CACHED MODEL REPLAY**, never a live-model claim.

Official model and API references:

- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter GPT-5 Mini](https://openrouter.ai/openai/gpt-5-mini)
- [OpenRouter zero data retention](https://openrouter.ai/docs/guides/features/zdr)

## 8. Deterministic system responsibilities

### Policy engine

- terminal-state stop;
- verified-payment stop;
- active-promise protection;
- late-authorization or native-retry hold;
- dispute suppression;
- per-case contact limit;
- cooldown and quiet-period enforcement;
- high-value and material-concession approval;
- allowed action and payment-method checks; and
- deterministic transition validation.

### Capacity allocator

- enforce daily contact and review budgets;
- rank only policy-eligible actions;
- select no more work than the configured capacity;
- record why a lower-ranked case was deferred; and
- reallocate capacity when a payment, promise, dispute, or block changes eligibility.

### Financial ledger

- represent money in integer currency subunits;
- correlate recovery case, Payment Link, Order, Payment, and webhook event IDs;
- verify raw-body webhook signatures;
- deduplicate event delivery;
- tolerate delayed and out-of-order events;
- reconcile recovered and outstanding totals; and
- prevent AI output or frontend callbacks from becoming financial truth.

## 9. Bounded action set

The hackathon version should support:

- **WAIT**
- **VERIFY_PAYMENT_STATE**
- **SEND_CONTEXTUAL_REMINDER**
- **SEND_PAYMENT_LINK**
- **REQUEST_PAYMENT_COMMITMENT**
- **OFFER_PARTIAL_PAYMENT**
- **FOLLOW_UP_BROKEN_PROMISE**
- **ESCALATE_DISPUTE**
- **ESCALATE_TO_HUMAN**
- **CLOSE_CASE**

Generic reminders remain a baseline capability. Recoup's value is the eligibility, timing, context, capacity allocation, and measurable decision—not the sending mechanism.

Adding an action requires:

1. a plausible recovery mechanism;
2. a policy treatment;
3. observable eligibility inputs;
4. an auditable execution event;
5. a simulator response model;
6. a baseline comparison; and
7. a reason it improves the live story or measured outcome.

## 10. Product surfaces

Build one finance workspace with three connected views.

### A. Recovery Command Center

- overdue exposure;
- verified Test Mode collections, separated from simulation;
- simulated incremental-recovery range versus native and fixed baselines;
- today's contact and reviewer capacity;
- prioritized ACT NOW queue;
- protected WAIT queue with reasons;
- urgent approvals; and
- Recovery Frontier control.

The split between **ACT NOW** and **WAIT / PROTECTED** should be visually prominent. This is the product identity.

### B. Decision Replay

- complete case timeline;
- observable information available at decision time;
- AI interpretation and proposal;
- deterministic policy result;
- capacity-allocation result;
- human approval or override;
- customer response;
- Razorpay event provenance; and
- before/after balance reconciliation.

### C. Evidence Lab

- native baseline, finance baseline, and Recoup comparison;
- portfolio, scenario, seed, and policy hash;
- contact-budget sensitivity;
- held-out results and uncertainty range;
- case-level attribution;
- guardrail statistics;
- metric definitions;
- evidence labels; and
- limitations.

Do not build separate finance, manager, admin, and customer portals for the hackathon.

## 11. Evaluation contract

### Primary counterfactual

The main comparison is not “Recoup versus nothing.” It is:

> Recoup versus Razorpay-native collection/reminder behavior at the same contact-equivalent budget, with a fixed finance SOP as a second challenger.

A no-intervention strategy remains useful only to estimate simulated spontaneous recovery.

### Common inputs

All strategies receive:

- identical starting receivables;
- identical observable customer histories;
- identical evaluation windows;
- identical policy constraints;
- identical contact and review budgets;
- identical native-automation assumptions; and
- comparable customer conditions.

### Pre-generated potential-outcome bank

The current simulator keys some response draws to the selected action. Before comparing strategies, generate and freeze an explicit potential-outcome bank for every case, day, and allowed action.

The bank should contain synthetic outcomes such as:

- spontaneous payment if no action occurs;
- response/no-response for each eligible action;
- immediate full or partial payment;
- promise creation and reliability;
- dispute signal; and
- late or delayed financial confirmation.

Both strategies query the same frozen bank for the action they choose. Save a hash of the bank with the run. The agent must never see it.

This does not make the benchmark real-world causal evidence. It does make the comparison reproducible, paired, inspectable, and less vulnerable to accidental random differences.

### Scenario families

- **Conservative:** small intervention effects, higher spontaneous recovery, expensive contacts.
- **Standard:** central disclosed assumptions.
- **Adversarial:** low response, more disputes, weaker promises, delayed events.
- **Relationship-sensitive:** stricter contact costs and approval rules for strategic accounts.

Development uses one set of seeds. Final evaluation uses held-out seeds that are not used to tune the agent.

### Primary metrics

- simulated incremental rupees recovered versus Razorpay-native baseline;
- simulated incremental rupees recovered versus fixed finance baseline;
- rupees recovered per contact;
- contacts per fully recovered case;
- days to verified or simulated recovery;
- protected contacts avoided;
- active promises respected;
- partial and fulfilled promises;
- broken promises reactivated;
- human-review load;
- policy blocks by reason;
- late-state or duplicate-collection hazards prevented; and
- ledger reconciliation validity.

Safety events such as duplicate outreach prevented must be reported separately from recovered revenue. Do not convert them into rupees without a disclosed and defensible model.

## 12. Evidence boundaries

Every result must be labelled as one of:

- **RAZORPAY TEST MODE**
- **SYNTHETIC RECEIVABLE**
- **SIMULATED CUSTOMER RESPONSE**
- **SIMULATED PAYMENT OUTCOME**
- **MEASURED AGENT DECISION**
- **DETERMINISTIC POLICY DECISION**
- **HUMAN APPROVAL**
- **VERIFIED TEST WEBHOOK**

Required disclosure:

> Razorpay Test Mode demonstrates integration behavior and verified event processing. The synthetic benchmark compares strategies under disclosed assumptions. Neither proves real merchant recovery performance.

Never say:

> Recoup recovered ₹8 lakh.

Say:

> In the held-out synthetic benchmark, Recoup produced ₹8 lakh of simulated recovery versus ₹5.6 lakh for the Razorpay-native reminder baseline at the same contact budget, a simulated incremental difference of ₹2.4 lakh under the disclosed assumptions.

## 13. Razorpay integration choice

### Hackathon collection primitive

Continue using a Standard Payment Link as the primary rail because:

- it is directly testable;
- it supports hosted collection;
- it can accept partial payments;
- it exposes stable Link, Order, and Payment identifiers;
- it emits partial, paid, expired, and cancelled events; and
- the current repository already proves the full-payment webhook loop.

Imported receivables plus Payment Links tell a clearer story than expanding into full Invoice/GST generation.

### Test Mode

Status: **TESTABLE** for Payment Link creation, hosted payment, lifecycle events, signature verification, correlation, and idempotent state updates.

Limitations:

- documented maximum of 30 Payment Links per Test Mode business;
- no real money;
- no evidence of real notification delivery or customer behavior;
- payment-method behavior can differ from Live Mode; and
- Test Mode collection is not impact evidence.

Use one or a few Test Mode Links for the live proof. Keep the batch evaluation provider-neutral and synthetic.

### Not in the hackathon core

- Optimizer or AI gateway routing;
- authentic payment degradation;
- Magic Checkout abandonment;
- direct mandate management;
- Subscription retry scheduling;
- full Invoice/GST generation;
- Smart Collect activation;
- production SMS, email, WhatsApp, or voice delivery; and
- live financing or credit decisions.

These can appear only as future adapters, not completed capabilities.

## 14. Revised milestone order

### Current foundation

Already present:

- Test Mode Standard Payment Link creation;
- signed raw-body webhook verification;
- duplicate-event protection;
- one operational case that becomes recovered from a verified payment;
- deterministic synthetic portfolio generation;
- fixed age-based baseline;
- case states, partial payments, promises, disputes, guardrails, audit events, and metrics; and
- reproducible simulation artifacts.

### Milestone 3 — Native baseline and capacity

- Add a Razorpay-native reminder baseline distinct from the finance-age baseline.
- Add daily portfolio contact and human-review budgets.
- Add ACT NOW and WAIT / PROTECTED queue semantics.
- Ensure the same policy limits apply to all comparable strategies.

**Done when:** strategies must choose which eligible cases not to contact and native automation is represented honestly.

### Milestone 4 — Frozen paired evaluation environment

- Pre-generate potential outcomes for case/day/action combinations.
- Save the potential-outcome bank and hash with every run.
- Add scenario families and held-out seed sets.
- Remove any strategy access to hidden behavior.
- Add comparison reconciliation and assumption manifests.

**Done when:** a third party can reproduce and inspect why the strategy results differ.

### Milestone 5 — Hybrid Recoup agent

- Use AI to extract structured signals from customer text and collections notes.
- Produce a schema-validated bounded action proposal.
- Store facts, reason, confidence, and model version.
- Apply deterministic policy after every proposal.
- Allocate eligible actions under the daily capacity budget.
- Cache batch decisions for reproducible evaluation.

**Done when:** the agent completes a held-out batch without hidden-state access, invalid actions, or policy bypass.

### Milestone 6 — Recovery Frontier

- Compare native baseline, finance baseline, and Recoup.
- Plot simulated recovery against contact/review burden.
- Add budget and scenario controls.
- Show uncertainty/range across held-out seeds.
- Attribute every difference to case-level decisions.
- Make protected WAIT decisions visible.

**Done when:** a judge can understand the decision advantage, burden trade-off, evidence source, and assumptions in under one minute.

### Milestone 7 — Live partial payment — IMPLEMENTED; HOSTED ACCEPTANCE PENDING

- Extend operational cases narrowly for partially paid state and outstanding balance.
- Enable partial payment on the demo Payment Link.
- Process payment_link.partially_paid and payment_link.paid idempotently.
- Handle delayed and out-of-order events without balance regression.
- Stop or adjust outreach immediately after verified collection.

**Done when:** one real Test Mode partial payment reduces the correct case balance exactly once.

### Milestone 8 — Live AI commitment interpreter and recovery handoff — IMPLEMENTATION COMPLETE; LIVE ACCEPTANCE PENDING

This is the first major, unmistakably AI-focused product milestone. It must show that the model changes a recovery decision, not merely generate copy.

- Add a server-side OpenRouter adapter using pinned `openai/gpt-5-mini`, strict structured output, compatible-provider routing, timeouts, typed failures, and local schema/invariant validation.
- Parse the live ambiguous English/Hinglish response into intent, ₹40,000 proposed now, a dated remainder promise, invoice-verification ambiguity, a bounded proposed action, and exact supporting evidence spans.
- Persist the customer message, canonical input hash, prompt/schema/provider/model versions, validated output or failure, policy evaluation, human decision, promise, and append-only audit events.
- Make partial-payment, dispute/ambiguity, high-value, low-confidence, and conflicting-field proposals require explicit human approval. Preserve the original proposal when a reviewer overrides it.
- Create or reuse the existing partial-enabled Razorpay Standard Payment Link only after the proposal is policy-eligible and approved.
- Keep the promise pending until the partial payment is verified. After the signed ₹40,000 Test Mode webhook, derive the authoritative ₹35,000 remainder, activate promise protection, and retain webhook idempotency and monotonic accounting.
- Add a small operational Test Mode queue using the seeded recovery cases. Move `INV-003` to WAIT / PROTECTED and deterministically promote the next eligible case when its contact slot is released.
- Keep this operational queue visually and metrically separate from the synthetic Recovery Frontier; a live webhook must not rewrite or masquerade as a synthetic benchmark result.
- Add a frozen, manually reviewed English/Hinglish corpus with amount/date/dispute/injection cases. Compare the model with a deterministic keyword/regex parser using intent, amount, date, dispute recall, evidence grounding, schema failures, and post-policy unsafe-action rate.
- Freeze evaluated model outputs by context, prompt, schema, provider, and model hash before any paired synthetic downstream comparison. Continue to label downstream recovery differences as simulated, not causal uplift.
- Add a clearly labelled cached-model replay for demo resilience.

**Done when:** a judge can watch unstructured customer text change the bounded recovery plan, see deterministic policy demand approval, complete a verified Razorpay Test Mode partial payment, observe the exact ₹75,000 → ₹35,000 balance transition once, see the remaining promise protected and the operational contact slot reallocated, and replay every step with provenance.

### Milestone 9 — Judge-facing workspace — IMPLEMENTATION COMPLETE

- Unify the existing Command Center, the new operational Decision Replay, and Evidence Lab without adding separate role-based portals.
- Add provenance badges, metric definitions, and limitations.
- Add deterministic demo reset and seeded scenarios.
- Harden the implemented live-payment fixture, cached-model replay, and recorded fallback.
- Rehearse the three-minute flow and skeptical judge questions.

**Done when:** the complete story remains coherent even if the external payment step fails.

Milestone 9 was completed on 2026-09-03. A shared four-step journey now connects the Recovery Frontier, operational Decision Replay, Razorpay proof, and Evidence Lab. The UI adds evidence-provenance badges, exact metric definitions, explicit limitations, persisted OpenRouter privacy posture, an input- and context-bound cached model replay, and a recorded-payment preview labelled **RECORDED SIMULATION — NO LEDGER WRITE**. That preview invokes no provider, verifies no signature, mutates no ledger state, and changes no recovery metric.

The operational demo reset is a narrow transaction over only `rc_m1_inv_001`, `rc_m1_inv_002`, and `rc_m7_inv_003`. A transaction-local database flag permits deletion from otherwise immutable demo history only for those IDs; unrelated operational records, schema, and external Razorpay Test Mode objects remain untouched. Development enables the reset; a production-mode demo requires explicit `DEMO_RESET_ENABLED=true`.

### Remaining roadmap after Milestone 9

Milestone 8 implementation was completed on 2026-09-03 with the pinned live OpenRouter adapter, strict local invariants, immutable operational persistence, deterministic policy and approval, webhook-authoritative promise activation, operational queue reallocation, frozen bilingual evaluation corpus, measured hashed model comparison, cached replay, database integration coverage, and browser coverage. Milestone 9 then consolidated and hardened that work without adding product breadth.

The remaining acceptance work is tracked in [Todo.md](../../Todo.md). The hosted ₹40,000 Razorpay Checkout-to-public-webhook run was not completed; only authenticated read-only Test Mode access and the signed-payload local integration path were exercised. The single ZDR-preferred smoke again found no eligible ZDR route and succeeded through the documented `data_collection: deny` fallback. The application persists and displays that fallback posture rather than implying ZDR.

The final `commitment-prompt-v1.0.3` corpus artifact records all 12 outcomes explicitly. Of 11 provider-eligible cases, 9 validated; intent accuracy was 72.7%; pay-now amount, promised amount, date, and evidence grounding were each 81.8%; dispute recall was 100%. The injection case was blocked preflight without a provider call. Provider and schema failures were zero. `english-full-today` and `malformed` failed deterministic invariants with `PROMISE_FIELDS_CONFLICT`, and post-policy unsafe action rate remained 0%. These are measured model decisions on synthetic messages, not merchant recovery evidence.

No product milestone remains for the hackathon scope. The user-assisted hosted Test Mode acceptance is the only outstanding proof.

Final verification on 2026-09-03 passed lint, typecheck, 55 non-database tests, six disposable-database integration tests, one Chromium judge-journey test, and the production build. Desktop and narrow responsive views of the Command Center, Decision Replay, cached provenance, and recorded fallback were visually inspected. The final local fixture state was reset after inspection.

Model-driven batch ranking, autonomous concessions, generated outbound messaging, production communication channels, calibrated risk/uplift scores, natural-language policy compilation, cross-product Razorpay adapters, document verification, and autonomous multi-agent negotiation are explicitly deferred until after the hackathon core is complete.

## 15. Scope decisions

| Feature | Decision | Reason |
| --- | --- | --- |
| Intervention-vs-wait agent | BUILD | Core differentiated recovery decision. |
| Daily contact/reviewer capacity | BUILD | Makes prioritization economically meaningful. |
| Razorpay-native reminder baseline | BUILD | Prevents an artificially weak comparison. |
| Recovery Frontier | BUILD | Strongest measurable and visual portfolio moment. |
| Paired potential-outcome bank | BUILD | Makes synthetic comparison reproducible and inspectable. |
| Promise-aware partial-payment case | BUILD | Strongest live B2B recovery journey. |
| Policy, approval, and audit replay | BUILD | Makes agent autonomy bounded and credible. |
| Payment Link partial/full webhook reconciliation | BUILD | Connects the demo to verified Razorpay money facts. |
| Cross-product case model | MODIFY | Keep conceptual adapter boundaries; implement Payment Links only. |
| Natural-language policy compiler | DEFER | Visually interesting but supporting, not the recovery mechanism. |
| Smart Collect adapter | DEFER | Valuable B2B rail but activation and scope risk are unnecessary. |
| Subscription recovery | DEFER | Native retries reduce differentiation and widen scope. |
| Checkout abandonment | DEFER | B2C-adjacent and entitlement-dependent. |
| Multiple role-specific portals | DROP | UI breadth obscures the core decision loop. |
| Generic reminders as innovation | DROP | Razorpay already supplies them. |
| AI gateway routing or payment confirmation | DROP | Duplicative and financially unsafe. |
| Production multichannel delivery | DROP for hackathon | Consent, delivery, and integration work do not strengthen the proof enough. |

## 16. Judge critiques of the candidate concepts

### Selected: intervention-vs-wait recovery agent

~~~yaml
Feature: Intervention-vs-wait agent with Recovery Frontier
Track relevance: CORE
Expected revenue impact: Allocates scarce interventions only where acting is expected to add recovery beyond waiting or native automation, while protecting promises and ambiguous payment states.
How impact can be measured: Paired held-out synthetic evaluation under identical portfolios, policies, contact budgets, native assumptions, and frozen potential outcomes.
Baseline: Razorpay-native Payment Link/reminder behavior; fixed finance age-bucket strategy as a second baseline.
Evidence:
  Razorpay Test Mode: Proves hosted collection, partial/full payment events, signature verification, correlation, and idempotent ledger updates.
  Synthetic receivables: Supply controlled overdue portfolios and business context.
  Simulated customer behavior: Supplies disclosed potential outcomes for act, wait, promise, dispute, and partial-payment paths.
  Measured agent outcomes: Structured proposals, policy results, capacity allocation, actions, and decision attribution.
  Assumptions: Intervention effect, spontaneous payment, contact cost, promise reliability, dispute propensity, and outcome attribution.
Razorpay overlap: Razorpay owns collection primitives and native reminders; Recoup owns intervention-vs-wait strategy, business context, capacity allocation, promises, policy, and comparison.
Demo value: HIGH
Evaluation risks:
  - Synthetic assumptions could still favor Recoup.
  - Expected incremental value is not calibrated without merchant data.
  - A complex chart could obscure the live cash loop.
Likely judge challenge: How do you know acting caused the difference rather than your simulator?
Recommendation: BUILD
Reason: It is central, differentiated, visibly measurable, feasible on the current foundation, and honest when presented as paired synthetic evidence plus verified Test Mode integration.
~~~

### Next build: live AI commitment interpreter and recovery handoff

~~~yaml
Feature: Live AI commitment interpreter and recovery handoff
Track relevance: CORE
Expected revenue impact: Converts an ambiguous response into an actionable partial-payment path, protects the remaining commitment, and reallocates scarce contact capacity instead of sending another generic reminder.
How impact can be measured: Compare frozen model interpretations with a deterministic parser under the same policy, contact budget, and paired synthetic outcome bank; separately demonstrate collection with a verified Razorpay Test Mode webhook.
Baseline: Razorpay-native Payment Link reminders plus a deterministic keyword/date parser and the fixed finance SOP.
Evidence:
  Razorpay Test Mode: Local signed-payload tests prove webhook validation, idempotency, correlation, and balance reconciliation. A user-assisted hosted partial collection through a public webhook remains pending and would prove the end-to-end hosted path; neither mode proves real revenue uplift.
  Synthetic receivables: Supply the reviewed bilingual interpretation corpus and comparable receivable contexts.
  Simulated customer behavior: Supplies frozen downstream outcomes for incremental-recovery comparison.
  Measured agent outcomes: Supply structured interpretations, grounded evidence, proposals, policy decisions, approval outcomes, and queue changes.
  Assumptions: Customer-response effects, promise reliability, payment propensity, attribution window, and contact cost remain disclosed synthetic assumptions.
Razorpay overlap: Razorpay supplies Payment Links, partial payments, hosted Checkout, reminders, and payment webhooks; Recoup supplies unstructured-response interpretation, policy gating, approval, promise protection, capacity reallocation, and evidence replay.
Demo value: HIGH
Evaluation risks:
  - A single polished message may look scripted or cherry-picked.
  - Synthetic downstream outcomes cannot establish real causal uplift.
  - Incorrect dispute or amount extraction could cause unsafe outreach without fail-closed policy.
Likely judge challenge: Is AI actually changing the recovery decision, or merely extracting fields before a workflow that rules could already execute?
Recommendation: BUILD
Reason: It is the narrowest milestone that makes AI necessary, visible, bounded, measurable against a credible parser baseline, and connected end-to-end to verified Razorpay Test Mode collection.
~~~

### Future: broad cross-product recovery control plane

~~~yaml
Feature: Normalize Payment Links, Invoices, Subscriptions, failures, and Smart Collect into one recovery plane
Track relevance: CORE
Expected revenue impact: Could prioritize and coordinate recovery across fragmented payment products.
How impact can be measured: Product-specific case outcomes and verified collections compared with each product's native behavior.
Baseline: Independent native product automation and dashboards.
Evidence:
  Razorpay Test Mode: Varies by product and account entitlement.
  Synthetic receivables: Needed for cross-product workload.
  Simulated customer behavior: Needed for outreach outcomes.
  Measured agent outcomes: Cross-product actions and policy decisions.
  Assumptions: Product access, state normalization, and comparable attribution.
Razorpay overlap: Strong differentiation at the orchestration layer but very high implementation and entitlement surface.
Demo value: MEDIUM
Evaluation risks:
  - Shallow integrations.
  - Account activation blockers.
  - Too many states for a three-minute narrative.
Likely judge challenge: Which of these integrations actually works end to end?
Recommendation: DEFER
Reason: Keep it as the product vision, but implement one excellent Payment Link path for the hackathon.
~~~

## 17. Likely judge questions

### “Razorpay already sends reminders. What did you build?”

Razorpay executes collection and native reminders. Recoup decides whether an additional intervention is eligible and incrementally worthwhile, allocates limited capacity, interprets promises and disputes, applies policy, and measures the decision against the native baseline.

### “Would these customers have paid anyway?”

Show spontaneous synthetic outcomes, the native-reminder baseline, paired potential outcomes, held-out seeds, and the Recovery Frontier. State plainly that the result is simulated rather than a real causal estimate.

### “Did you design the simulator so Recoup wins?”

Show the frozen scenario manifest and hash, common potential-outcome bank, held-out seeds, conservative/adversarial results, and any case or scenario where Recoup loses.

### “Why is this AI?”

Replay the ambiguous response, show structured signal extraction and the bounded next-action proposal, then show deterministic policy and capacity allocation. Fixed rules cannot reliably interpret the message, but AI still cannot alter financial truth.

### “Why does WAIT matter in revenue recovery?”

Waiting protects active promises, avoids duplicate collection during ambiguous payment state, respects cooldowns, and frees scarce recovery capacity for a case where action can add more value.

### “Is that money real?”

The portfolio result is synthetic and labelled. A signed Razorpay event is Test Mode integration evidence, not real money or merchant uplift. The checked-in automated proof uses representative signed payloads; the hosted Checkout-to-public-webhook run is still pending. The recorded fallback is only an illustrated rehearsal path and writes no ledger state.

### “Was Zero Data Retention verified?”

No. The 2026-09-03 smoke found no eligible ZDR route. The bounded request succeeded with `data_collection: deny`, and that exact privacy posture is persisted and displayed. ZDR is a preference, not a safety or product dependency.

### “Can the fallback be mistaken for payment proof?”

No. It is labelled **RECORDED SIMULATION — NO LEDGER WRITE**, does not invoke Razorpay, has no verified signature or payment/event ID, and cannot change the authoritative balance, promise, queue, or metrics.

## 18. Three-minute demo

1. **Problem — 15 seconds:** “We have ₹38 lakh overdue and only 20 safe customer contacts today. Razorpay can collect and remind; the missing decision is where intervention adds value.”
2. **Recovery Frontier — 40 seconds:** compare native reminders, finance rules, and Recoup at the same budget; switch once to the conservative scenario.
3. **Decision attribution — 25 seconds:** open one ACT NOW case and one protected WAIT case to show why the portfolio differs.
4. **Live customer response — 35 seconds:** paste the ambiguous English/Hinglish message and show structured AI interpretation.
5. **Policy and approval — 20 seconds:** possible dispute triggers human review; approve the safe partial-payment action.
6. **Razorpay collection — 35 seconds:** in a user-assisted session, complete the Test Mode partial payment. If external delivery is unavailable, open the recorded fallback and say explicitly that it is a no-ledger simulation.
7. **Closure loop — 20 seconds:** on the hosted branch, show signed event, exact balance reduction, protected promise, contact-slot reallocation, and audit timeline. On the fallback branch, present the same transition only as an illustration of expected behavior.
8. **Close — 10 seconds:** “Recoup knows when to act, when to wait, and can prove every recovery decision.”

## 19. Definition of winning completion

The project is ready only when it can show:

- a Razorpay-native reminder baseline rather than an artificially weak alternative;
- one fixed portfolio capacity that forces meaningful prioritization;
- one agent-selected ACT NOW case and one deliberately protected WAIT case;
- one paired, held-out synthetic comparison with frozen assumptions and case-level attribution;
- one Recovery Frontier that shows recovery versus contact burden;
- one ambiguous response converted into a bounded partial-payment and promise proposal;
- one deterministic policy approval, block, or escalation;
- one verified Razorpay Test Mode partial or full payment tied to the correct case exactly once;
- one immediate queue reallocation after that verified event;
- a complete decision replay and reconciled ledger; and
- unmistakable separation of Test Mode, synthetic, simulated, measured, and assumed evidence.

The final positioning is:

> **Recoup is the recovery agent that knows when intervention adds value, when silence is safer, and how to turn the right decision into verified collection through Razorpay.**
