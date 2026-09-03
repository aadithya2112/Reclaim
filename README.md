# Recoup — Razorpay Receivables Recovery Spike

Milestones 1–7 are complete. They prove a verified recovery loop: a local overdue invoice becomes a partial-enabled Razorpay Test Mode Payment Link, signed partial/full payment webhooks advance the balance monotonically, and the application-owned recovery case becomes `PARTIALLY_PAID` or `RECOVERED` exactly once per payment.

Two planned milestones remain:

1. **Milestone 8 — Live AI commitment interpreter and recovery handoff:** use OpenRouter with a pinned structured-output-capable model to interpret an ambiguous English/Hinglish response, pass the proposal through deterministic policy and human approval, collect a verified Test Mode partial payment, protect the authoritative remainder promise, and reallocate the released operational contact slot.
2. **Milestone 9 — Judge-facing hardening:** unify Decision Replay and the Evidence Lab with the existing Command Center, add provenance and limitations, provide deterministic reset and fallbacks, and rehearse the three-minute demo.

The next milestone deliberately keeps `recoup-hybrid` as the deterministic, reproducible Recovery Frontier strategy. Live model inference is introduced for unstructured customer-response interpretation, where AI changes a bounded recovery decision and remains visibly subordinate to policy, approval, and verified Razorpay webhooks.

## What is included

- Bun + Next.js App Router + TypeScript
- PostgreSQL + Drizzle ORM
- Razorpay Payment Links through the REST API
- Raw-body HMAC webhook verification plus duplicate and out-of-order delivery protection
- A dedicated partial-payment demo case (`INV-003`, ₹75,000)
- An operator workspace that polls while the verified webhook is pending

The operational loop remains intentionally small. A separate pure TypeScript simulation harness now evaluates bounded recovery workflows without changing the PostgreSQL schema or calling Razorpay.

The root workspace now opens the Milestone 6 Recovery Command Center. The original verified Razorpay Test Mode collection loop remains available at `/collection`.

## Deterministic recovery simulation (Milestones 2–5)

Run a reproducible synthetic benchmark:

```bash
bun run simulate --cases 1000 --days 30 --evaluation-set custom --seed 42
# Inspect one complete journey:
bun run simulate --cases 100 --days 30 --evaluation-set custom --seed 42 --case sim-case-000001
# Run the Razorpay-native baseline with explicit daily budgets:
bun run simulate --strategy razorpay-native-reminders --contact-capacity 25 --review-capacity 5
# Run the keyless Recoup hybrid strategy:
bun run simulate --strategy recoup-hybrid --contact-capacity 25 --review-capacity 5
# Compare all strategies in the default development set and standard scenario:
bun run simulate --compare --cases 1000 --days 30 --scenario standard --evaluation-set development --contact-capacity 25 --review-capacity 5
# Intentional final held-out evaluation (do not tune strategy behavior to these results):
bun run simulate --compare --cases 1000 --days 30 --scenario adversarial --evaluation-set held-out --contact-capacity 25 --review-capacity 5
# A deliberate single seed is explicitly custom, never labelled development/held-out:
bun run simulate --compare --cases 1000 --days 30 --scenario standard --evaluation-set custom --seed 42
```

**Simulation outcomes are synthetic and are not claims about actual Razorpay merchant recovery performance.** All receivables, customer behavior, responses, promises, disputes, and payments produced by this harness are synthetic. The harness makes no network or database calls. Razorpay Test Mode continues to prove only the separate Milestone 1 integration behavior.

### Architecture and implementation note

- The operational `recovery_cases` and Razorpay-specific `payments` tables remain separate from the simulator. The simulator reuses their conceptual accounting rule—accepted payments reduce outstanding money exactly once—but uses provider-neutral, unmistakably synthetic payment events.
- Simulation-only cases, promises, latent customer traits, audit events, and metrics live under `src/simulation`. Keeping them out of operational tables avoids hidden synthetic attributes contaminating merchant state and avoids a risky webhook refactor.
- A strategy receives only an explicit observable projection: invoice and balance facts, dates, visible history, contacts, promises, and current status. Hidden response, ability, willingness, dispute, and reliability assumptions stay in a separate environment map.
- `RecoveryStrategy` is pluggable. Recoup and all three baselines use observable information only. A separate policy engine enforces terminal stops, dispute/escalation stops, cooldowns, contact limits, promise protection, and high-value human review.
- `recoup-hybrid` is the frozen, keyless Milestone 5 decision model. It emits a runtime-validated bounded proposal with supporting factors, confidence, strategy version, and an observable-only priority score. The score ranks scarce work; it is explicitly not a calibrated payment probability. No external model is invoked in benchmark runs.
- Every evaluated case/day decision is written to a hashed `decision-cache.json`. This makes proposal inputs and outputs reproducible and prepares an adapter boundary for future cached external-model interpretations without allowing live model variance into paired evaluation.
- Contact capacity and human-review capacity are independent daily budgets. Contact actions consume only contact capacity. `ESCALATE_TO_HUMAN` consumes only review capacity. Policy-protected `WAIT` decisions consume neither.
- Every virtual day settles due environment events for all cases, evaluates the complete portfolio, classifies `ACT_NOW` and `WAIT_PROTECTED`, globally allocates both queues, then executes selected work. Ranking uses broken-promise status, outstanding paise, overdue age, prior attempts, and finally case ID; it never uses hidden customer traits.
- Money is integer paise. Payments are capped at the remaining balance, synthetic event and payment identifiers are unique, and final metrics are derived from authoritative case state and reconciled against ending outstanding balances.

### Strategy semantics

- `recoup-hybrid` chooses between deliberate waiting, the least forceful eligible contact, a direct Payment Link, a commitment request, broken-promise follow-up, and human review. It considers only outstanding value, overdue age, visible payment/promise/dispute history, risk segment, prior attempts, and current case state. Deterministic policy retains final authority and can block or replace every proposal.
- `finance-age-bucket` preserves the original finance baseline as a deterministic overdue-age SOP: gentle reminder, payment reminder, Payment Link, commitment request, then human review. `baseline` remains a CLI alias for compatibility.
- `razorpay-native-reminders` is a clearly labelled simulation assumption derived from Razorpay's documented Payment Link reminder capability. It assumes a Payment Link exists at the evaluation start and models at most three fixed reminders on simulation days 0, 3, and 7. Those exact days are a benchmark assumption, not a Razorpay default or API contract. The harness does not call Razorpay, send SMS/email, prove delivery, or prove recovery.
- `no-intervention` takes no new recovery action. It is useful only for observing synthetic spontaneous payments and outcomes from promises already in state.

Razorpay documents configurable Payment Link reminders over SMS/email and supports up to three reminders. See [Payment Link Reminders](https://razorpay.com/docs/payments/payment-links/reminders/?preferred-country=IN) and [Payment Links APIs](https://razorpay.com/docs/api/payments/payment-links/?preferred-country=IN). Recoup models that native capability as the primary counterfactual; its differentiated layer is policy-aware intervention versus wait, scarce-capacity allocation, protection, and audit—not reminder delivery.

### Determinism, assumptions, and day order

The logical run ID is derived from simulator version and normalized configuration. A fixed epoch (`2026-01-01` by default), deterministic IDs, stable case ordering, and keyed random draws ensure unrelated outcomes do not shift when another random draw occurs. Identical version, seed, strategy, scenario, and policy configuration produce identical domain artifacts.

The versioned scenario manifests define four hand-authored synthetic families: `conservative` (more spontaneous payment and smaller intervention effects), `standard`, `adversarial` (low response, weak promises, more disputes), and `relationship-sensitive` (higher relationship/contact costs and softer automated escalation). They explicitly disclose responsiveness, ability/willingness, spontaneous payment, promise reliability, dispute propensity, action modifiers, and relationship assumptions. They are not calibrated Razorpay or merchant probabilities, and no scenario is tuned to guarantee a future Recoup strategy wins. Invoice amounts use a skewed mixture (45% small, 35% medium, 17% large, 3% high value), while overdue dates span 1–5, 6–15, 16–30, 31–60, and 61–100 days.

Each virtual day has four deterministic portfolio phases: (1) due promise payments, promise breakage, and spontaneous synthetic payments; (2) observable strategy and policy evaluation for every case; (3) global contact and human-review allocation; and (4) execution of capacity-selected work. Due-day promise realization therefore occurs before any new contact. Active promises suppress contact through their due day. A smaller due payment marks a promise partially fulfilled; an unpaid active promise becomes broken on the following day and becomes eligible for follow-up.

Eligible work is never selected by incidental array order. Each capacity queue is sorted using only observable factors, with case ID as the final stable tie-break. Review exhaustion produces `HUMAN_REVIEW_CAPACITY_EXHAUSTED`; contact exhaustion produces `CONTACT_CAPACITY_EXHAUSTED`. Deferred work stays eligible for re-evaluation on the next virtual day.

### Artifacts and metric semantics

Single runs atomically replace `simulation-results/run-<logical-id>/` and write `config.json`, observable `portfolio.json`, explicitly hidden `simulation-state.json`, `decision-cache.json`, `cases-final.json`, `synthetic-payments.jsonl`, ordered `audit-events.jsonl`, `daily-capacity.json`, `metrics.json`, and `summary.md`. Comparison runs additionally write `scenario-manifest.json`, `potential-outcome-bank.json` labelled **HIDDEN SYNTHETIC ENVIRONMENT — NEVER PROVIDED TO STRATEGIES**, a compact `comparison.json`, `comparison.md`, and complete artifacts per strategy. The compact comparison references rather than duplicates the full bank and per-run event streams. The SHA-256 bank hash is present in the comparison and every constituent run; reconciliation confirms common portfolio, hidden state, policy, capacity, scenario, evaluation-set inputs, and per-case money. Comparison outputs report paired simulated recovery differences versus the Razorpay-native baseline alongside added contact/review burden; these are not causal uplift estimates.

Recovery rate is simulated recovered paise divided by starting outstanding paise. Fully recovered means ending outstanding is zero; partially recovered means the run recovered positive money while a positive balance remains; unresolved excludes fully recovered, disputed, escalated, and closed cases. Promise fulfillment rate uses all created promises as its denominator. Capacity metrics report total budget, consumption, deferred eligible decisions, protected decisions/contacts, and utilization separately for contacts and reviews. Zero denominators return zero. INR formatting is presentation-only.

Comparisons use one materialized, versioned potential-outcome bank per comparison. It pre-generates state-independent unit draws for spontaneous payment, every case/day/contact action/feasible attempt, response, disputes, immediate full/partial payment, promise amount/due date, and promise realization. A strategy consumes only the draw for its executed action and never receives hidden profiles or the bank. This makes the result paired, reproducible, and inspectable; it does not establish real-world causality, calibrated probabilities, or merchant uplift. Development seeds are `[42, 91, 123]`; held-out seeds are `[2027, 3407, 9811]`. The repository cannot cryptographically hide held-out files from its developers—process discipline, not secrecy, prevents tuning to final results. Razorpay Test Mode remains separate evidence for integration behavior only.

### Milestone 4.1 and Recoup replay

Named development/held-out comparisons run every declared seed and write a suite manifest, aggregate JSON/Markdown, constituent comparison IDs and bank hashes. The aggregate fails closed if any constituent reconciliation fails, and reports per-seed recovery/incremental recovery versus native reminders, ranges, recovery per contact, capacity, promise/protection/policy/safety measures, and win/tie/loss counts. Three seeds do not support confidence-interval or significance claims.

`contactCostMultiplier` is now an auditable synthetic relationship-burden metric (never subtracted from recovered money). The relationship-sensitive scenario applies an additional disclosed multiplier to observable long-history accounts.

`recoup-agent` is replay-only in the pure simulator. The existing direct OpenAI Responses adapter is an unwired preparation boundary, not a live product integration. Milestone 8 will add a server-side OpenRouter adapter using pinned `openai/gpt-5-mini`, the documented strict JSON Schema response format, compatible-provider routing, and shared Zod/business validation. It will freeze context hashes, prompt/schema versions, provider/model IDs, validated decisions, and a manifest hash when preparing evaluation decisions. Replay makes no model calls; a missing or mismatched record is an explicit cache miss. The model receives only observable text/context as untrusted data, has no tools, and never sees profiles, outcome banks, future results, or payment truth. Deterministic policy, human approval, and capacity allocation own final actions.

OpenRouter references: [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [`openai/gpt-5-mini`](https://openrouter.ai/openai/gpt-5-mini), and [zero data retention](https://openrouter.ai/docs/guides/features/zdr).

### Recovery Command Center (Milestone 6)

Open `http://localhost:3000` to use the judge-facing development benchmark:

- **Recovery Frontier:** reruns Recoup, Razorpay-native reminders, and the finance SOP across multiple daily contact ceilings on identical synthetic inputs. The chart presents simulated recovery against actual contact burden, with human-review counts and the range across all three development seeds alongside it. Held-out seeds remain untouched.
- **Scenario and capacity controls:** switch among the four disclosed scenarios and change daily contact/reviewer ceilings. Results are generated locally, cached in process, and require no database, model key, Razorpay credential, or network service.
- **Decision queues:** inspect capacity-selected ACT NOW work, policy/model-protected WAIT decisions, and eligible work deferred by exhausted capacity.
- **Decision replay:** view the bounded proposal, observable supporting factors, confidence, deterministic policy outcome, compact audit timeline, the native baseline's action on the same case, and the paired per-case simulated recovery difference.
- **Evidence boundary:** identifies synthetic receivables, simulated outcomes, measured decisions, and the separate Razorpay Test Mode proof. Reproducibility hashes are available without exposing hidden environment state to the browser.

The dashboard API is `GET /api/recovery-frontier?scenario=standard&contacts=20&reviews=4`. It returns a compact observable projection only; hidden customer traits and the potential-outcome bank are never serialized into the response. Dashboard runs use the development seed, never the held-out evaluation seeds.

### Verified partial-payment loop (Milestone 7)

The `/collection` workspace uses `INV-003` as a fresh ₹75,000 Test Mode fixture. Its Standard Payment Link accepts partial payment with a deterministic first-payment floor of the greater of ₹500 or 25% of the link amount. The application stores the link ID, unique reference, amount, and starting recovered balance for explicit correlation.

Both `payment_link.partially_paid` and `payment_link.paid` are accepted only after raw-body signature verification. Payment and event IDs are unique, the case row is locked during mutation, and Razorpay's cumulative `amount_paid` advances the application balance monotonically. A delayed older partial event therefore cannot reopen or reduce a fully recovered case. `PARTIALLY_PAID` adjusts outreach to the remaining balance; `RECOVERED` stops it. These are verified Test Mode integration facts, not evidence of live merchant uplift.

## Local setup

Requirements: Bun 1.3+, Docker Desktop, a Razorpay account with Test Mode API keys, and [zrok](https://docs.zrok.io/docs/getting-started/).

Milestone 8 additionally requires an OpenRouter API key with available credit and access to the pinned structured-output-capable model. No separate OpenAI key is required for the planned live adapter.

```bash
bun install
docker compose up -d
cp .env.example .env.local
bun run db:migrate
bun run db:seed
bun dev
```

Update `.env.local` before starting the app:

```env
DATABASE_URL=postgresql://recovery:recovery@localhost:5432/recovery
APP_URL=https://your-public-zrok-url.example
RAZORPAY_KEY_ID=rzp_test_replace_me
RAZORPAY_KEY_SECRET=replace_me
RAZORPAY_WEBHOOK_SECRET=replace_me
OPENROUTER_API_KEY=replace_me
OPENROUTER_RECOUP_MODEL=openai/gpt-5-mini
```

Only a key beginning with `rzp_test_` is accepted. Never put real credentials in `.env.example` or commit `.env.local`.

## Expose the webhook

Enable zrok once using the token from your zrok account, then share the local Next.js server:

```bash
zrok enable YOUR_ZROK_TOKEN
zrok share public http://localhost:3000
```

Copy the public HTTPS URL into `APP_URL` and restart `bun dev`. In the Razorpay Dashboard, while **Test Mode** is selected:

1. Open **Account & Settings → Webhooks**.
2. Add `https://YOUR-ZROK-URL/api/webhooks/razorpay`.
3. Set the same secret used in `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to `payment_link.partially_paid` and `payment_link.paid`.

Razorpay cannot deliver a webhook directly to localhost and documents zrok as its local testing route. See [Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).

## Run the recovery demo

1. Open `http://localhost:3000/collection` and confirm `INV-003` is `OPEN` with ₹75,000 outstanding.
2. Select **Create test payment link**.
3. Open the returned Razorpay-hosted checkout and complete a partial [Test Mode payment](https://razorpay.com/docs/payments/payments/test-card-details/).
4. Return to the workspace and confirm the signed webhook changes the case to `PARTIALLY_PAID`, reduces the balance exactly once, and adjusts outreach to the remainder.
5. Pay the remaining balance through the same link. Confirm the case becomes `RECOVERED`, outstanding reaches zero, and outreach stops.
6. Inspect the ledger for each payment's Razorpay event type and cumulative link-paid value.

The callback URL only returns the browser to the workspace. It never changes case state. Only a valid signed supported webhook can record money or advance recovery status.

## Commands

```bash
bun dev                 # local development
bun run build           # production build
bun run lint            # ESLint
bun run typecheck       # TypeScript without emit
bun test                # unit tests
bun run simulate --cases 1000 --days 30 --evaluation-set custom --seed 42
bun run simulate --strategy recoup-hybrid --contact-capacity 25 --review-capacity 5
bun run simulate --strategy finance-age-bucket --contact-capacity 25 --review-capacity 5
bun run simulate --strategy razorpay-native-reminders --contact-capacity 25 --review-capacity 5
bun run simulate --strategy no-intervention --contact-capacity 25 --review-capacity 5
bun run simulate --compare --cases 1000 --days 30 --evaluation-set custom --seed 42 --contact-capacity 25 --review-capacity 5
bun run db:generate     # generate a migration from the schema
bun run db:migrate      # apply migrations
bun run db:seed         # idempotently create the operational demo fixtures
```

Database integration tests are opt-in so the normal unit suite does not mutate a developer database. Point `TEST_DATABASE_URL` at a migrated disposable PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://recovery:recovery@localhost:5432/recovery \
  bun run test:integration
```

## API surface

- `GET /api/recovery-cases/:id` — current local case and captured payments
- `GET /api/recovery-frontier` — compact observable Milestone 6 benchmark projection
- `POST /api/recovery-cases/:id/payment-link` — create or return the case’s existing Test Mode Payment Link
- `POST /api/webhooks/razorpay` — verify and process Razorpay webhook events

The Razorpay integration follows the current [Payment Link creation API](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [Payment Link webhook payload](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=IN), and [webhook signature/idempotency guidance](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).
