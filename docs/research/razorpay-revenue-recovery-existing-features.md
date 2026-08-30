# Razorpay capabilities relevant to AI Revenue Recovery

**Last verified:** 2026-08-30  
**Scope:** Current official Razorpay documentation and official Razorpay product sources, with India-specific documentation preferred where available.  
**Research question:** What recovery-related capability does Razorpay already provide, and where can an AI-powered B2B receivables product add defensible value without duplicating it?

> **Critical evidence warning:** Razorpay Test Mode proves integration behavior—API contracts, state transitions, signatures, webhook handling, and selected success/failure simulations. It does **not** prove real-world recovery impact, customer response, deliverability, payment-rail performance, or causal incremental revenue. Any recovery-rate uplift shown with Test Mode or synthetic debtors must be labelled simulated or synthetic.

## Executive conclusion

Razorpay already provides most of the **payment and collection primitives** that a recovery product would need:

- Checkout warns about or disables degraded instruments; Optimizer can route across gateways to improve success rates.
- Orders and Payments expose attempts, structured failures, and late-authorisation state changes.
- Magic Checkout can emit abandoned-cart data and report abandoned checkouts.
- Subscriptions automatically retry failed recurring charges, notify customers, allow payment-method changes, and expose `pending` and `halted` states.
- Payment Links and Invoices provide hosted collection, expiry, partial payments, notifications, resend/reminder functions, lifecycle states, and product-specific webhooks.
- Smart Collect supplies customer-specific bank-transfer identifiers and automated reconciliation for large NEFT/RTGS/IMPS receipts.
- Webhooks and fetch APIs supply the verified financial facts needed to confirm recovery safely.

Therefore, a strong hackathon product should **not** present link creation, generic reminders, automatic subscription retries, failure dashboards, or webhook ingestion as its core innovation. The defensible opportunity is a cross-product recovery control plane that turns receivable context into bounded decisions: which case to work, why, when, through which Razorpay primitive, with what concession or escalation, when to stop, and how to attribute verified collections against a credible baseline.

## Test Mode classification

- `TESTABLE`: Official documentation describes a direct Test Mode path for the relevant contract and state transition.
- `PARTIALLY TESTABLE`: Important parts can be tested, but some rails, delivery, account enablement, or live behavior cannot be established.
- `SIMULATION REQUIRED`: The business phenomenon cannot be produced faithfully in Test Mode; synthetic input is required.
- `LIVE-ONLY / BLOCKED`: Official documentation explicitly requires Live Mode or live account activation for the behavior.
- `UNKNOWN`: Current official documentation reviewed here does not establish Test Mode support.

## Feature matrix

| Capability | What Razorpay already provides | Primary primitive | Test Mode | Project opportunity beyond Razorpay | Decision | Confidence |
|---|---|---|---|---|---|---|
| Payment-instrument degradation handling | Downtime status, Checkout messaging, and disabling instruments likely to fail | Checkout + Payment Downtime data | `SIMULATION REQUIRED` for real degradation | Use live/synthetic degradation context only as a guardrail in case strategy; do not rebuild rail health | `DROP` as a core feature | High on capability; Test simulation unresolved |
| Multi-gateway success-rate optimisation | Rules, gateway priority, traffic split, and smart routing through Optimizer | Optimizer | `UNKNOWN`; on-demand activation and provider credentials required | Treat Optimizer as payment infrastructure; AI can choose recovery timing/offer, not invent gateway routing | `DROP` from core | High on product; medium on access |
| One-time payment failure recovery | Structured failure metadata, `payment.failed`, multiple attempts on one Order, alternative-method retry | Order + Payment + Checkout | `TESTABLE`, with method-specific limitations | Classify recoverability and decide a compliant follow-up after failure | `BUILD` orchestration, reuse primitives | High |
| Late authorisation | Bank polling, Orders grouping, capture/refund controls, `payment.authorized` | Payment + Order + capture settings | `SIMULATION REQUIRED` for authentic delayed bank outcome | Prevent duplicate outreach/double collection; reconcile late success into the case | `BUILD` guardrail | High |
| Checkout abandonment | Abandoned-cart webhook and checkout reports/analytics in Magic Checkout | Magic Checkout webhook/report | `PARTIALLY TESTABLE`; feature/platform enablement required | Prioritise high-value abandonments and select bounded retargeting; mostly B2C, not core B2B AR | `DEFER` | High on feature; medium on general availability |
| Subscription dunning | Automatic retries, customer failure notifications, payment-method update, pending/halted states, manual invoice charge | Subscription + generated Invoice + webhooks | `TESTABLE` with accelerated test charges and constraints | Add case-level policy after/around built-in retries, not another retry scheduler | `MODIFY` | High; exact live retry count/timing needs account validation |
| Mandates and recurring debits | Card, UPI Autopay, and eMandate recurring collections; token/mandate lifecycle | Subscription or S2S recurring token + Order/Payment | `PARTIALLY TESTABLE` | Decide whether and when a mandate-based receivable needs human/contact escalation | `DEFER` unless demo uses subscriptions | High on primitives; medium on account access |
| Payment Links | Hosted payment URL, expiry, partial payments, notifications, reminders, resend, lifecycle webhooks | Payment Link | `TESTABLE`; max 30 links per business in Test Mode | Choose case, amount, expiry, partial-payment floor, channel, and timing with policy/audit | `BUILD` as collection rail | High |
| Invoices and B2B receivables | Itemised invoice, expiry, partial payments, SMS/email issue/resend, hosted payment, states, reports | Invoice + Payment/Order | `PARTIALLY TESTABLE`; core API/state is testable, external delivery not impact evidence | Import/manage overdue case context, strategy, promises, escalation, attribution | `BUILD` selectively | High |
| Bank-transfer receivables | Customer-specific virtual accounts, NEFT/RTGS/IMPS collection, webhook reconciliation | Smart Collect Customer Identifier / Virtual Account | `TESTABLE` with simulated bank transfers | Reconcile large B2B receipts and stop outreach immediately; allocate ambiguous receipts | `MODIFY` / optional | High |
| Payment-method choice | Cards, UPI, netbanking, wallets; optional EMI/Pay Later and checkout configuration | Checkout / Methods API / Payment Link options | `PARTIALLY TESTABLE` | Recommend a documented available method based on failure reason and case constraints—not approve credit | `MODIFY` | High |
| Financial-state verification | Signed asynchronous events, duplicate event IDs, non-guaranteed order, API fetch fallback | Webhooks + fetch APIs | `TESTABLE` | Idempotent recovery ledger, explicit correlation, no AI-authored financial truth | `BUILD` foundational | High |
| Dashboards, reports, and existing automation | Payment/failure metrics, product reports, reminders, retry automation, abandonment reports | Dashboard + product automation | `PARTIALLY TESTABLE` | Cross-product case queue, causal measurement, decision audit, policy and human review | `BUILD` differentiated layer | High |

## Detailed capability assessment

### 1. Payment degradation and payment-failure recovery

#### What Razorpay already provides

Razorpay identifies payment-instrument downtime, communicates it to merchants, shows customers a warning at Checkout, and can temporarily disable an instrument that is expected to fail so the customer can choose an alternative. The official downtime documentation says the status refreshes every five minutes. See [Downtime Updates](https://razorpay.com/docs/payments/payments/downtime-updates/?preferred-country=IN).

For merchants using multiple gateways, Optimizer provides rules, priority routes, traffic splits, and a smart router intended to improve success rates using real-time data. It is an on-demand feature that requires activation and credentials for the relevant payment providers. See [About Optimizer](https://razorpay.com/docs/payments/optimizer/?preferred-country=IN), [Create Custom Rules](https://razorpay.com/docs/payments/optimizer/create-custom-rule/?preferred-country=IN), and [Get Started with Optimizer](https://razorpay.com/docs/payments/optimizer/get-started/?preferred-country=IN).

For an individual failed attempt, Checkout and Payment entities expose structured error information including `code`, `source`, `step`, `reason`, and correlation metadata. A customer can attempt multiple payments against the same `order_id`; `order.attempts` increments, and a retry does not require a new Order unless the fulfilment scenario changes. See the [Standard Checkout integration guide](https://razorpay.com/docs/developer-tools/integrations/standard-checkout/) and [Payment Method Error Parameters](https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/?preferred-country=IN).

#### Underlying primitive

- Payment-instrument downtime: Razorpay Checkout and Payment Downtime information.
- Cross-gateway degradation: Optimizer rules and routing.
- Attempt-level failure: Order, Payment, Checkout error object, and `payment.failed` webhook.
- Recovery attempt: another Payment against the same stable Order when the business amount and fulfilment context have not changed.

#### Test Mode

**Status:** `TESTABLE` for ordinary success/failure responses and multi-attempt Orders; `SIMULATION REQUIRED` for authentic ecosystem degradation; `UNKNOWN` for a fully representative Optimizer demo.

Test Mode provides mock success/failure flows for cards, netbanking, wallets, and selected UPI cases. UPI has explicit caveats: payment cancellation is not represented faithfully in Test Mode, and UPI Intent/QR availability differs. See [Quick Integration test flows](https://razorpay.com/docs/payments/payment-gateway/quick-integration/integration-steps/?preferred-country=IN) and [Test UPI IDs](https://razorpay.com/docs/payments/payments/test-upi-details/?preferred-country=IN).

The reviewed Optimizer documentation confirms on-demand activation and multi-provider prerequisites but does not establish a self-serve Test Mode path that reproduces real gateway degradation. Do not claim live routing improvement from a synthetic demo.

#### What the project can add

Use the failure reason and verified payment history as inputs to a deterministic recovery policy: suppress contact for likely late authorisation, recommend another already-supported method for a customer-fixable failure, create a receivables case after an appropriate delay, or escalate a high-value repeated failure. The AI may explain and rank options, but should not determine whether money was paid.

#### Confidence and unresolved questions

**Confidence:** High that Razorpay already owns downtime handling, failure telemetry, and multi-gateway routing.  
**Unresolved:** Optimizer entitlement, merchant account access, provider setup, Test Mode routing fidelity, and whether Payment Downtime data has an accessible API contract for this hackathon account.

**Decision:** `DROP` payment routing/degradation detection as a headline feature. `BUILD` only the receivable-level action policy around verified failure facts.

### 2. Late authorisation and duplicate-payment risk

#### What Razorpay already provides

When the bank response is delayed, Razorpay can poll for status changes for up to three days and later move the Payment to `authorized`. Orders group multiple attempts, and if one succeeds while another becomes late-authorised, Razorpay documents protective handling to avoid treating both as the successful Order payment. Merchants can use capture settings and `payment.authorized` notifications. See [Late Payment Authorisations](https://razorpay.com/docs/payments/payments/late-authorisation/?preferred-country=IN) and [Handle Late Authorised Payments](https://razorpay.com/docs/payments/payments/late-authorisation/handle/?preferred-country=IN).

#### Underlying primitive

Payment state, Order grouping, capture/refund configuration, `payment.authorized`, and fetch APIs.

#### Test Mode

**Status:** `SIMULATION REQUIRED` for the actual delayed-bank phenomenon. Ordinary Payment state and webhook handling are testable, but the official material reviewed does not provide a deterministic Test Mode recipe that reproduces a real delayed authorisation.

#### What the project can add

Keep a failed attempt in a bounded “verification pending” recovery state, re-fetch when necessary, suppress premature reminders, and close or adjust the case only after verified financial state. This is a safety and customer-trust feature, not a claim that AI recovered the payment.

#### Confidence and unresolved questions

**Confidence:** High.  
**Unresolved:** Exact live auto-refund windows vary across Razorpay documentation and locale/product context; fetch current account-specific capture settings before production use.

**Decision:** `BUILD` as a deterministic guardrail and demo the transition with clearly labelled simulated delay plus a real Test Mode webhook contract.

### 3. Checkout abandonment

#### What Razorpay already provides

Magic Checkout can emit abandoned-checkout data containing contact, cart, UTM, and an `abandoned_checkout_url`, enabling retargeting. Magic Checkout reports include completed and abandoned checkouts and can support checkout-funnel and abandoned-cart analysis. See [Abandoned Cart Webhook](https://razorpay.com/docs/payments/magic-checkout/abandoned-cart/?preferred-country=IN) and [Magic Checkout Reports](https://razorpay.com/docs/payments/magic-checkout/analytics/reports/).

Magic Checkout analytics also exposes events such as `checkout_abandoned`, `payment_initiated`, and `payment_failed`; the documentation notes that payment events may fire multiple times during retries. See [Magic Checkout Analytics Event Reference](https://razorpay.com/docs/payments/magic-checkout/web/analytics-event-reference/?preferred-country=IN).

#### Underlying primitive

Magic Checkout abandoned-cart webhook, browser analytics events, and downloadable/scheduled reports.

#### Test Mode

**Status:** `PARTIALLY TESTABLE`.

The documentation includes test-shaped webhook examples, but event emission requires Magic Checkout features to be enabled and platform setup. Availability is platform/account dependent; the reviewed official docs do not establish universal Test Mode entitlement.

#### What the project can add

Rank abandonments by expected collectible value, use consent and contact-frequency rules, choose whether to retarget, and measure recovered checkout value against a holdout. This is adjacent to B2C cart recovery and may dilute a B2B receivables story.

#### Confidence and unresolved questions

**Confidence:** High on the feature; medium on immediate hackathon availability.  
**Unresolved:** Account enablement, platform compatibility, consent/deliverability policy, webhook authentication contract specific to this Magic Checkout hook, and whether it is in the judging scope for B2B receivables.

**Decision:** `DEFER` unless the product scope intentionally includes commerce abandonment and the account already has Magic Checkout access.

### 4. Subscriptions and recurring-payment recovery

#### What Razorpay already provides

Razorpay Subscriptions automatically initiates recurring charges. A failed auto-charge moves the Subscription to `pending`, Razorpay retries, sends failure/action-required notifications, and allows the customer to change the card or payment method. After retries are exhausted, the Subscription becomes `halted`; invoices continue to be generated but are not automatically charged. Older issued invoices can be charged manually. See [Payment Retries](https://razorpay.com/docs/payments/subscriptions/payment-retries/?preferred-country=IN), [Subscription States](https://razorpay.com/docs/payments/subscriptions/states/?preferred-country=IN), and [Subscription Notifications](https://razorpay.com/docs/payments/subscriptions/notifications/).

Relevant events include `subscription.pending`, `subscription.halted`, `subscription.charged`, and `subscription.activated`. See [Subscription Webhooks](https://razorpay.com/docs/payments/subscriptions/subscribe-to-webhooks/?preferred-country=IN).

#### Underlying primitive

Plan, Subscription, generated Invoice, recurring payment token/mandate, manual invoice charge, and Subscription webhooks.

#### Test Mode

**Status:** `TESTABLE`, with limitations.

Test Mode lets a merchant trigger a charge immediately, choose success or failure, drive `pending` and `halted` transitions, and receive the associated webhooks. The official test guide says card tokens are valid for only three days in Test Mode and that some update behavior cannot be tested after subsequent test charges. See [Test Subscriptions](https://razorpay.com/docs/payments/subscriptions/test/?preferred-country=IN).

The documentation is not perfectly consistent in its prose about retry count (for example, “post 3 retry attempts” versus failing a test charge four times to exhaust attempts). Treat the exact retry schedule/count as a product/account behavior to validate rather than hard-code.

#### What the project can add

Do not create a parallel retry engine. Add policy around the native lifecycle: prioritize high-value `pending`/`halted` cases, decide when a manual request or human escalation is justified, adapt the message to failure class and customer history, enforce quiet periods and stop rules, and measure incremental recovery beyond Razorpay's built-in retry baseline.

#### Confidence and unresolved questions

**Confidence:** High on lifecycle and testability.  
**Unresolved:** Exact retry cadence/count by Cards, UPI, and eMandate; live notification templates and merchant control; domestic-card manual-charge restrictions; account enablement and current regulatory limits.

**Decision:** `MODIFY` any proposed “AI retry scheduler” into a post-native-dunning decision and escalation layer.

### 5. Mandates and recurring payments

#### What Razorpay already provides

Subscriptions supports recurring payments through cards, UPI Autopay, and eMandate. The supported bank/app list is dynamic and can be fetched through the Methods API. See [Supported Banks and Apps](https://razorpay.com/docs/payments/subscriptions/supported-banks-apps/?preferred-country=IN).

For direct recurring-payment integrations, UPI Autopay uses a customer, Order, authorisation Payment, and resulting `token_id` representing the mandate; subsequent Orders can be charged using that token. Tokens can be fetched and cancelled, and webhooks track mandate/payment changes. See [UPI Autopay](https://razorpay.com/docs/payments/payment-gateway/s2s-integration/recurring-payments/upi/?preferred-country=IN).

These are collection authorisations, not an AI recovery system. Regulatory and AFA thresholds can require customer action, and support varies by bank, app, merchant category, and account.

#### Underlying primitive

Subscription or S2S recurring Orders/Payments with a stable mandate/token ID; Methods API; recurring-payment webhooks.

#### Test Mode

**Status:** `PARTIALLY TESTABLE`.

Subscription state machines and selected charges are directly testable. This does not prove a real bank mandate, notification timing, AFA experience, live debit success, or recovery impact. Some live payment-method behavior and activation remain account dependent.

#### What the project can add

Map mandate failure to a receivable case; distinguish “retry still active” from “halted/action required”; recommend safe next action; and avoid contacting a customer while a native retry or asynchronous confirmation is pending.

#### Confidence and unresolved questions

**Confidence:** High on supported primitives.  
**Unresolved:** Exact current limits and exemptions for this merchant category, entitlement for S2S recurring products, test credentials, and retry behavior outside Subscriptions.

**Decision:** `DEFER` direct mandate integration unless central to the demo. Prefer Subscription webhooks if recurring recovery is demonstrated.

### 6. Payment Links: partial payments, reminders, expiries, and notifications

#### What Razorpay already provides

Payment Links are hosted collection URLs creatable by Dashboard or API. A Standard Payment Link supports amount in currency subunits, unique `reference_id`, customer details, `expire_by`, SMS/email notification controls, `accept_partial`, minimum first partial amount, notes, and reminders. The API exposes lifecycle states and captured Payment details. See [Create a Standard Payment Link API](https://razorpay.com/docs/api/payments/payment-links/create-standard/?preferred-country=IN).

Razorpay supports account-level or per-link reminders, with up to three configured reminders and SMS/email channels, as well as manual/API resend. See [Payment Link Reminders](https://razorpay.com/docs/payments/payment-links/reminders/?preferred-country=IN), [Resend a Payment Link](https://razorpay.com/docs/payments/payment-links/resend/?preferred-country=IN), and [Payment Links APIs](https://razorpay.com/docs/api/payments/payment-links/?preferred-country=IN).

Partial payments remain tied to the same Order while each instalment gets a unique Payment ID. Product events include `payment_link.partially_paid`, `payment_link.paid`, `payment_link.expired`, and `payment_link.cancelled`. See [Partial Payments](https://razorpay.com/docs/payments/payment-links/partial-payments/?preferred-country=IN) and [Payment Link Webhook Events](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=IN).

#### Underlying primitive

`POST /v1/payment_links`, Payment Link ID (`plink_...`), unique `reference_id`, Payment/Order IDs, resend endpoint, and product-specific webhooks.

#### Test Mode

**Status:** `TESTABLE`.

Razorpay recommends creating and paying Payment Links in Test Mode, where the hosted flow can simulate success or failure. The documented Test Mode limit is 30 Payment Links per business. See [Create a Payment Link](https://razorpay.com/docs/payments/payment-links/create/?preferred-country=IN).

Test Mode still does not prove SMS/email deliverability, customer action, conversion, or live method availability.

#### What the project can add

The project should decide **why and when** to create a link, which verified outstanding amount to request, whether partial payment is allowed, the minimum acceptable first payment, expiry, channel, and stopping rule. It should correlate `plink_id`, `reference_id`, Order, and Payment to one recovery case and attribute only captured/verified amounts.

#### Confidence and unresolved questions

**Confidence:** High.  
**Unresolved:** Reminder schedule configuration may be account-level rather than fully controlled per case; minimum upfront amount may require account enablement; notification pricing/delivery and channel consent need validation.

**Decision:** `BUILD` Payment Links as the primary demo collection rail, but `DROP` “we generate links/send reminders” as the differentiator.

### 7. Invoices and B2B receivables

#### What Razorpay already provides

Razorpay Invoices can create itemised bills with customer data, expiry, partial payments, hosted payment links, states, and reports. Issuing an Invoice can notify the customer by SMS/email; customers may pay online and documented invoice flows also mention bank transfer. See [How Invoices Work](https://razorpay.com/docs/payments/invoices/how-it-works/?preferred-country=IN) and [Invoices APIs](https://razorpay.com/docs/api/payments/invoices/?preferred-country=IN).

The Invoice entity exposes `amount`, `amount_paid`, `amount_due`, `status`, `payment_id`, `order_id`, `expire_by`, and notification status. Notifications can be resent by `POST /v1/invoices/:id/notify_by/:medium` for eligible `issued` or `partially_paid` invoices. See [Create Invoice API](https://razorpay.com/docs/api/payments/invoices/create-with-customer-id/?preferred-country=IN), [Send Invoice Notifications](https://razorpay.com/docs/api/payments/invoices/resend/?preferred-country=IN), and [Invoice States](https://razorpay.com/docs/payments/invoices/states/?preferred-country=IN).

Events include `invoice.partially_paid`, `invoice.paid`, and `invoice.expired`, with Payment and Order entities included for paid states. See [Invoice Webhook Events](https://razorpay.com/docs/webhooks/invoices/?preferred-country=IN).

#### Underlying primitive

Invoice (`inv_...`), associated Order and Payment, customer, line items, issue/resend/cancel APIs, and Invoice webhooks.

#### Test Mode

**Status:** `PARTIALLY TESTABLE`.

The API reference exposes Test API keys, and generic Razorpay Test Mode supports isolated test entities and transactions. Core create/issue/pay/state/webhook behavior is appropriate to test. However, the reviewed Invoice guide does not establish that external SMS/email delivery and all bank-transfer behavior are fully representative; even successful delivery would not prove recovery impact.

#### What the project can add

Ingest receivables from an ERP/ledger, detect overdue cases, prioritize by expected recoverable value, model promises-to-pay and disputes, choose a bounded action, stop after verified payment, and show attribution/audit. Razorpay Invoice state remains separate from recovery-case state.

#### Confidence and unresolved questions

**Confidence:** High on API and lifecycle.  
**Unresolved:** GST/API constraints for the intended merchant, account entitlements, relationship between Invoice bank-transfer option and Smart Collect configuration, notification delivery/cost, and Test Mode limits.

**Decision:** `BUILD` selectively if real invoice context strengthens the B2B story; otherwise use imported receivables plus Payment Links to keep the demo focused.

### 8. Smart Collect for large B2B bank transfers

#### What Razorpay already provides

Smart Collect creates customer-specific identifiers/virtual accounts for NEFT, RTGS, and IMPS, automatically tracks incoming transfers, and supports reconciliation. Customer ID and `bank_reference` can aid correlation. See [Smart Collect APIs](https://razorpay.com/docs/payments/smart-collect/apis/?preferred-country=IN), [Create Customer Identifiers](https://razorpay.com/docs/payments/smart-collect/create/?preferred-country=IN), and [Smart Collect Webhooks](https://razorpay.com/docs/webhooks/smart-collect/?preferred-country=IN).

#### Underlying primitive

Customer Identifier / Virtual Account (`va_...`), receiver bank account, `virtual_account.credited`, Payment, bank-transfer entity, and bank reference/UTR.

#### Test Mode

**Status:** `TESTABLE` for simulated transfer receipt.

The Dashboard provides a Test-Mode-only “Make a Test Payment” flow for NEFT, RTGS, or IMPS. See [Make Test Payments](https://razorpay.com/docs/payments/smart-collect/test-payments/?preferred-country=IN). It does not prove a real bank transfer or real reconciliation SLA.

#### What the project can add

Use verified credits to allocate receipts to recovery cases and immediately stop outreach. Where a receipt is ambiguous, route it to deterministic/human review rather than letting AI declare it matched.

#### Confidence and unresolved questions

**Confidence:** High.  
**Unresolved:** Smart Collect activation/KYC, account availability, virtual-account costs, TPV needs, and whether Smart Collect 2.0 is enabled for the hackathon account.

**Decision:** `MODIFY` into an optional high-value B2B collection/reconciliation adapter; do not make it a prerequisite for the core demo.

### 9. Payment methods relevant to recovery

#### What Razorpay already provides

Standard flows support multiple methods including cards, UPI, netbanking, and wallets; Checkout configuration can order, highlight, or hide instruments. Payment Links can be configured to show selected methods. See [Checkout Payment Method Configuration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/understand-configuration/?preferred-country=IN) and [Customise Payment Link Methods](https://razorpay.com/docs/api/payments/payment-links/customise-payment-methods/?preferred-country=IN).

EMI can make large purchases payable in instalments, but it is a payment product with eligibility and cost implications—not the same as a merchant-approved receivables payment plan. See [About EMI](https://razorpay.com/docs/payments/payment-methods/emi/?preferred-country=IN).

#### Underlying primitive

Checkout configuration, Methods API, Payment Link options, and the Payment error taxonomy.

#### Test Mode

**Status:** `PARTIALLY TESTABLE`.

Mock success/failure exists for several methods and cards have error-scenario test data. Some UPI flows, cancellations, QR/Intent, issuer eligibility, EMI/Pay Later approval, and live availability cannot be inferred from Test Mode. See [Quick Integration test flows](https://razorpay.com/docs/payments/payment-gateway/quick-integration/integration-steps/?preferred-country=IN).

#### What the project can add

Recommend an already-enabled method when a verified failure reason suggests a customer-actionable alternative. Never promise eligibility, approve credit, or treat Test Mode method visibility as live availability. A partial Payment Link is a clearer receivables concession primitive than claiming the AI invented EMI.

#### Confidence and unresolved questions

**Confidence:** High on configuration; medium on account-specific method access.  
**Unresolved:** Current enabled methods, international/currency constraints, regulatory changes, and merchant eligibility.

**Decision:** `MODIFY` into constrained method guidance. `DROP` AI-created financing/credit decisions.

### 10. Webhooks and payment-state verification

#### What Razorpay already provides

Webhooks deliver asynchronous events for Payments, Orders, Payment Links, Invoices, Subscriptions, Smart Collect, and other products. Razorpay recommends webhooks for automation and an immediate fetch API when a critical user-facing confirmation cannot wait. A browser handler or `callback_url` is not a substitute for server-side verification. See [About Webhooks](https://razorpay.com/docs/webhooks/?preferred-country=IN).

Webhook authenticity uses HMAC-SHA256 over the **raw request body** with the webhook secret, compared with `X-Razorpay-Signature`. Duplicate deliveries are expected and can be identified with `x-razorpay-event-id`; delivery order is not guaranteed. See [Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).

Webhook endpoints must respond successfully within five seconds. Failed deliveries are retried with backoff for up to 24 hours, after which the webhook may be disabled. See [Set Up Payments Webhooks](https://razorpay.com/docs/webhooks/setup-edit-payments/?preferred-country=IN).

#### Underlying primitive

Signed raw HTTP event, event ID, product entity IDs, and authoritative fetch endpoints.

#### Test Mode

**Status:** `TESTABLE`.

Test Mode transactions trigger test webhooks with the same payload structure as Live Mode. Test and Live webhook URLs/configuration are separate. A public endpoint is required; localhost cannot be used directly and several common request-bin/tunnel domains are blocked. See [Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).

#### What the project can add

Maintain an idempotent event ledger; verify the signature before any state mutation; correlate by stable Razorpay IDs; fetch current state when needed; prevent regressions from out-of-order events; and count a recovery only once. AI must never author or override the financial truth.

#### Confidence and unresolved questions

**Confidence:** High.  
**Unresolved:** Product-specific event availability on the hackathon account and an operationally suitable public test endpoint.

**Decision:** `BUILD` as non-negotiable infrastructure, not as the wow feature.

### 11. Dashboards, reports, and built-in recovery automation

#### What Razorpay already provides

The Payments Dashboard includes collected amount, payment count, payment failure count, method split, transaction details, refunds, settlements, reports, and an AI-powered assistant for account queries such as finding failed payments. See [About Dashboard](https://razorpay.com/docs/payments/dashboard/?preferred-country=IN).

Product-specific automation already includes:

- Payment Link automated reminders and notifications.
- Subscription charge retries and failure/action-required notifications.
- Magic Checkout abandoned-checkout recording and reports.
- Optimizer routing rules and success-rate optimisation.
- Smart Collect reconciliation and notifications.

These features are documented in their respective sections above. None of the official sources reviewed describes a single cross-product B2B recovery-case system with case ranking, receivable-specific action policy, promise/dispute state, contact stopping rules, causal attribution, and a human-auditable AI decision trail.

#### Underlying primitive

Razorpay Dashboard, downloadable/scheduled reports, product-level settings, and product-specific entities/events.

#### Test Mode

**Status:** `PARTIALLY TESTABLE`.

Test data can populate entities, transactions, reports, and selected automation. It cannot establish live notification performance, operational impact, customer response, or incremental collection results.

#### What the project can add

Create the cross-product recovery control plane: normalized cases, prioritization by expected incremental value, bounded next-best action, policy checks, human escalation, promises/disputes, verified payment closure, and experiment-based attribution.

#### Confidence and unresolved questions

**Confidence:** High that the documented products cover individual payment operations but leave room for cross-product recovery orchestration.  
**Unresolved:** Razorpay may offer private, beta, enterprise, or account-specific functionality not documented publicly. Confirm with the hackathon team before making an absolute “Razorpay does not offer X” claim.

**Decision:** `BUILD` the differentiated case and measurement layer. `DROP` a generic clone of the Razorpay payments dashboard.

## Overlap risks for the proposed product

| Proposed feature | Overlap risk | Why | Required repositioning |
|---|---:|---|---|
| “Generate a Payment Link” | Very high | Native Dashboard/API capability | The value is choosing the case, terms, timing, and guardrails |
| “Send automated reminders” | Very high | Payment Links already offer scheduled reminders; Invoices can be resent; Subscriptions notify automatically | Add strategy, consent, frequency caps, stop rules, and experiment attribution |
| “Retry failed subscriptions” | Very high | Native automatic retry and pending/halted lifecycle | Act around native retries and after exhaustion; never double-retry blindly |
| “Recover abandoned carts” | High | Magic Checkout emits abandonment data and supports reports/retargeting inputs | Defer or focus on cross-channel prioritization with causal measurement |
| “Detect payment degradation” | Very high | Checkout downtime handling and Optimizer already address rail health/routing | Consume as context; do not rebuild |
| “Payment failure dashboard” | High | Razorpay Dashboard already exposes failures and method splits | Show receivable cases, expected incremental value, and decisions instead |
| “AI chooses payment gateway” | Very high and risky | Optimizer owns gateway routing with real-time payment data | Drop; AI should choose recovery action, not financial routing truth |
| “Partial payment plans” | Medium-high | Payment Links and Invoices already accept partial payments | Add policy-governed concession selection and approval, not the collection mechanism |
| “Verify payment by success page” | Unsafe | Browser success is not authoritative and webhooks/fetch APIs already exist | Use signed webhooks plus fetch and idempotency |
| “AI marks invoice recovered” | Unsafe | AI output cannot be financial truth | Only verified Razorpay Payment/Link/Invoice/Virtual Account facts can contribute to recovery |

## Strongest gaps and opportunities

1. **Cross-product recovery cases.** Normalize overdue receivables, failed Subscription charges, unpaid Invoices, partial Payment Links, and verified bank-transfer receipts without collapsing their distinct Razorpay states.
2. **Expected incremental value prioritization.** Rank work by recoverable amount × probability of incremental recovery × urgency/cost, with transparent factors and human override.
3. **Bounded next-best action.** Choose among wait/verify, native reminder, new Payment Link, partial-payment offer, method suggestion, human escalation, or stop—subject to deterministic policy.
4. **Contact and financial safety.** Quiet hours, consent, frequency caps, dispute suppression, promise-to-pay grace, late-authorisation holds, and immediate stop after verified collection.
5. **Attribution and honest measurement.** Tie an action to stable case/link/invoice/payment identifiers, compare with a baseline or holdout, and separate verified Test Mode collection from simulated incremental impact.
6. **Human-auditable AI.** Store the input facts, recommendation, reason, policy checks, approval, action, Razorpay event, and outcome as one visible recovery timeline.
7. **B2B context Razorpay payment objects do not encode.** Invoice aging, account importance, disputes, prior promises, collections notes, ERP balances, and relationship risk can inform action without overriding payment truth.

## Implications for hackathon differentiation

The strongest “wow” moment is not a generated message or a payment link. It is a visible, end-to-end chain:

`overdue receivable → explainable bounded decision → Razorpay collection primitive → signed Test Mode event → idempotent case closure → measured attributed value`

The demo should juxtapose three layers clearly:

- **Razorpay:** Payment Link/Invoice/Subscription/Smart Collect and verified payment events.
- **Our deterministic system:** case state, amounts due in integer currency subunits, correlation, policies, stopping rules, and attribution.
- **AI:** prioritization explanation and recommendation within the allowed action set; never payment confirmation or unconstrained financial decisions.

A defensible headline is: **“An auditable recovery control plane that decides and proves the next best receivables action, then collects through Razorpay.”** Avoid claiming that Razorpay lacks reminders, retries, abandonment tracking, routing intelligence, or dashboards.

## Recommended BUILD / MODIFY / DEFER / DROP decisions

### BUILD

- Recovery case model separate from Razorpay entity state.
- Payment Link creation as the primary collection rail, with stable case correlation.
- Signed, raw-body webhook verification; idempotency; out-of-order handling; fetch fallback.
- Verified partial/full-payment reconciliation and immediate outreach stop.
- Explainable prioritization, deterministic eligibility/policy checks, and human override.
- Action timeline connecting input, recommendation, approval, Razorpay event, and outcome.
- Honest impact dashboard separating verified Test Mode money flow from synthetic or simulated recovery uplift.
- Late-authorisation/duplicate-payment suppression guardrail.

### MODIFY

- Reframe “AI reminders” as policy-governed timing/content/channel selection around native notification primitives.
- Reframe “subscription recovery” as prioritization and escalation around Razorpay's built-in retries and halted state.
- Reframe “payment plans” as guarded partial-payment terms collected through Payment Links/Invoices, with explicit approval thresholds.
- Make Smart Collect an optional adapter for large B2B transfers and verified stop/reconciliation.
- Recommend alternative payment methods only from current enabled methods and verified failure context.

### DEFER

- Magic Checkout abandoned-cart recovery unless the product explicitly expands beyond B2B receivables and access is already available.
- Direct S2S mandate management and UPI Autopay unless recurring recovery is central to the judging story.
- Full Invoice/GST generation if imported receivables plus Payment Links tell the story more cleanly.
- Multi-channel production delivery integrations until consent, templates, costs, and delivery evidence are established.
- Live Optimizer integration and real gateway-degradation experiments.

### DROP

- A generic Razorpay Dashboard clone.
- Payment Link generation, generic reminders, or native Subscription retries presented as innovation.
- AI gateway routing, payment confirmation, credit approval, or autonomous settlement/refund decisions.
- A bespoke payment-status truth source or reliance on frontend callback/success state.
- Claims of real recovery uplift based only on Test Mode, synthetic debtors, or manually chosen successful outcomes.

## Razorpay integration check for the recommended core

### Business requirement

Recover overdue B2B receivables through a bounded, auditable workflow and prove collection with a verified Razorpay event.

### Existing Razorpay capability and project gap

Razorpay already provides hosted collection, partial payments, reminders/notifications, lifecycle events, and financial verification. The project gap is case prioritization, business-context strategy, deterministic guardrails, cross-product state, human review, and incremental-impact measurement.

### Razorpay primitive

Use a Standard Payment Link for the hackathon's primary recovery request; correlate it to one internal recovery case using the Payment Link ID plus a unique `reference_id`/notes. Consume `payment_link.partially_paid`, `payment_link.paid`, `payment_link.expired`, and `payment_link.cancelled`, while retaining the included Payment and Order IDs.

### Official sources

- [Create Standard Payment Link API](https://razorpay.com/docs/api/payments/payment-links/create-standard/?preferred-country=IN)
- [Payment Link Webhook Events](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=IN)
- [Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN)
- [Test and Live Modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN)

### Test Mode

**Status:** `TESTABLE` for link creation, hosted success/failure, link lifecycle, and webhook processing.  
**Limitations:** 30-link Test Mode limit; no real money; method behavior can differ; notifications and customer behavior are not impact evidence.

### API and webhooks

Amounts must be integer currency subunits. Authenticate server-side with Test API keys. Validate all external input and Razorpay errors. Verify HMAC-SHA256 against the raw body, deduplicate by event ID, tolerate out-of-order delivery, and fetch current Razorpay state for critical uncertainty.

### Correlation and ownership

- **Razorpay:** hosted payment experience, Payment/Order/Link state, capture, signed events.
- **Application:** amount due, recovery case, mapping, policy, outreach, stop state, attribution, audit.
- **AI:** recommendation and explanation inside an allowed action set.
- **Deterministic policy:** eligibility, caps, quiet periods, approval thresholds, state transitions, verified close.
- **Human:** exceptions, disputes, material concessions, and overrides.

### Risks

- Duplicating native reminders or retries.
- Double counting partial or duplicated events.
- Contact after payment because of delayed/out-of-order events.
- Treating Test Mode or synthetic results as real causal recovery.
- Product/account enablement differences and changing payment-method rules.

### Recommendation

**BUILD.** Use Razorpay as the verified collection layer and make the differentiated product the bounded recovery decision, audit, and measurement system around it.

## Final evidence boundary

This research describes publicly documented Razorpay capability as of the verification date. Product access, account entitlements, commercial terms, supported methods, retry policy, regulatory limits, and Test Mode behavior can be account- and time-dependent. Re-verify the specific merchant account and current official docs before production use.

Again: **Test Mode proves integration behavior, not real-world recovery impact.**
