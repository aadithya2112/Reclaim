# Recoup — Razorpay Receivables Recovery Spike

Milestone 1 proves a single recovery loop: a local overdue invoice becomes a Razorpay Test Mode Payment Link, a signed Razorpay webhook records the captured payment, and the application-owned recovery case becomes `RECOVERED`.

## What is included

- Bun + Next.js App Router + TypeScript
- PostgreSQL + Drizzle ORM
- Razorpay Payment Links through the REST API
- Raw-body HMAC webhook verification and duplicate-delivery protection
- One idempotent synthetic recovery case (`INV-001`, ₹50,000)
- An operator workspace that polls while the verified webhook is pending

The operational loop remains intentionally small. A separate pure TypeScript simulation harness now evaluates bounded recovery workflows without changing the PostgreSQL schema or calling Razorpay.

## Deterministic recovery simulation (Milestones 2–3)

Run a reproducible synthetic benchmark:

```bash
bun run simulate --cases 1000 --days 30 --seed 42
# Inspect one complete journey:
bun run simulate --cases 100 --days 30 --seed 42 --case sim-case-000001
# Run the Razorpay-native baseline with explicit daily budgets:
bun run simulate --strategy razorpay-native-reminders --contact-capacity 25 --review-capacity 5
# Compare all available strategies on equivalent starting portfolios:
bun run simulate --compare --cases 1000 --days 30 --seed 42 --contact-capacity 25 --review-capacity 5
```

**Simulation outcomes are synthetic and are not claims about actual Razorpay merchant recovery performance.** All receivables, customer behavior, responses, promises, disputes, and payments produced by this harness are synthetic. The harness makes no network or database calls. Razorpay Test Mode continues to prove only the separate Milestone 1 integration behavior.

### Architecture and implementation note

- The operational `recovery_cases` and Razorpay-specific `payments` tables are unchanged. The simulator reuses their conceptual accounting rule—accepted payments reduce outstanding money exactly once—but uses provider-neutral, unmistakably synthetic payment events.
- Simulation-only cases, promises, latent customer traits, audit events, and metrics live under `src/simulation`. Keeping them out of operational tables avoids hidden synthetic attributes contaminating merchant state and avoids a risky webhook refactor.
- A strategy receives only an explicit observable projection: invoice and balance facts, dates, visible history, contacts, promises, and current status. Hidden response, ability, willingness, dispute, and reliability assumptions stay in a separate environment map.
- `RecoveryStrategy` is pluggable. The finance age-bucket, Razorpay-native reminder, and no-intervention strategies use observable information only. A separate policy engine enforces terminal stops, dispute/escalation stops, cooldowns, contact limits, promise protection, and high-value human review.
- Contact capacity and human-review capacity are independent daily budgets. Contact actions consume only contact capacity. `ESCALATE_TO_HUMAN` consumes only review capacity. Policy-protected `WAIT` decisions consume neither.
- Every virtual day settles due environment events for all cases, evaluates the complete portfolio, classifies `ACT_NOW` and `WAIT_PROTECTED`, globally allocates both queues, then executes selected work. Ranking uses broken-promise status, outstanding paise, overdue age, prior attempts, and finally case ID; it never uses hidden customer traits.
- Money is integer paise. Payments are capped at the remaining balance, synthetic event and payment identifiers are unique, and final metrics are derived from authoritative case state and reconciled against ending outstanding balances.

### Strategy semantics

- `finance-age-bucket` preserves the original finance baseline as a deterministic overdue-age SOP: gentle reminder, payment reminder, Payment Link, commitment request, then human review. `baseline` remains a CLI alias for compatibility.
- `razorpay-native-reminders` is a clearly labelled simulation assumption derived from Razorpay's documented Payment Link reminder capability. It assumes a Payment Link exists at the evaluation start and models at most three fixed reminders on simulation days 0, 3, and 7. Those exact days are a benchmark assumption, not a Razorpay default or API contract. The harness does not call Razorpay, send SMS/email, prove delivery, or prove recovery.
- `no-intervention` takes no new recovery action. It is useful only for observing synthetic spontaneous payments and outcomes from promises already in state.

Razorpay documents configurable Payment Link reminders over SMS/email and supports up to three reminders. See [Payment Link Reminders](https://razorpay.com/docs/payments/payment-links/reminders/?preferred-country=IN) and [Payment Links APIs](https://razorpay.com/docs/api/payments/payment-links/?preferred-country=IN). Recoup models that native capability as the primary counterfactual; its differentiated layer is policy-aware intervention versus wait, scarce-capacity allocation, protection, and audit—not reminder delivery.

### Determinism, assumptions, and day order

The logical run ID is derived from simulator version and normalized configuration. A fixed epoch (`2026-01-01` by default), deterministic IDs, stable case ordering, and keyed random draws ensure unrelated outcomes do not shift when another random draw occurs. Identical version, seed, strategy, scenario, and policy configuration produce identical domain artifacts.

The documented `standard` scenario uses five centralized synthetic profiles: reliable late payer, cash-flow constrained, low responsiveness, dispute prone, and high risk. Invoice amounts use a skewed mixture (45% small, 35% medium, 17% large, 3% high value), while overdue dates span 1–5, 6–15, 16–30, 31–60, and 61–100 days. These are evaluation assumptions, not Razorpay data, and external validity is a known limitation.

Each virtual day has four deterministic portfolio phases: (1) due promise payments, promise breakage, and spontaneous synthetic payments; (2) observable strategy and policy evaluation for every case; (3) global contact and human-review allocation; and (4) execution of capacity-selected work. Due-day promise realization therefore occurs before any new contact. Active promises suppress contact through their due day. A smaller due payment marks a promise partially fulfilled; an unpaid active promise becomes broken on the following day and becomes eligible for follow-up.

Eligible work is never selected by incidental array order. Each capacity queue is sorted using only observable factors, with case ID as the final stable tie-break. Review exhaustion produces `HUMAN_REVIEW_CAPACITY_EXHAUSTED`; contact exhaustion produces `CONTACT_CAPACITY_EXHAUSTED`. Deferred work stays eligible for re-evaluation on the next virtual day.

### Artifacts and metric semantics

Single runs atomically replace `simulation-results/run-<logical-id>/` and write `config.json`, observable `portfolio.json`, explicitly hidden `simulation-state.json`, `cases-final.json`, `synthetic-payments.jsonl`, ordered `audit-events.jsonl`, `daily-capacity.json`, `metrics.json`, and `summary.md`. Comparison runs write `simulation-results/comparison-<logical-id>/comparison.json`, `comparison.md`, and one complete artifact directory per strategy. Generated run directories are ignored by Git and contain no credentials or real customer information.

Recovery rate is simulated recovered paise divided by starting outstanding paise. Fully recovered means ending outstanding is zero; partially recovered means the run recovered positive money while a positive balance remains; unresolved excludes fully recovered, disputed, escalated, and closed cases. Promise fulfillment rate uses all created promises as its denominator. Capacity metrics report total budget, consumption, deferred eligible decisions, protected decisions/contacts, and utilization separately for contacts and reviews. Zero denominators return zero. INR formatting is presentation-only.

Current limitations: assumptions are hand-authored, only the `standard` scenario exists, no AI strategy exists, and no communication channel is invoked. Strategies in a comparison receive equivalent deterministic starting portfolios and keyed hidden assumptions, but Milestone 4's frozen case/day/action potential-outcome bank is deliberately not implemented yet. Consequently comparison differences are reproducible synthetic scenario outputs, not paired causal estimates, calibrated probabilities, or evidence of real-world recovery. Razorpay Test Mode remains separate evidence for integration behavior only.

## Local setup

Requirements: Bun 1.3+, Docker Desktop, a Razorpay account with Test Mode API keys, and [zrok](https://docs.zrok.io/docs/getting-started/).

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
4. Subscribe to `payment_link.paid`.

Razorpay cannot deliver a webhook directly to localhost and documents zrok as its local testing route. See [Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).

## Run the recovery demo

1. Open `http://localhost:3000` and confirm `INV-001` is `OPEN` with ₹50,000 outstanding.
2. Select **Create test payment link**.
3. Open the returned Razorpay-hosted checkout and complete a [Test Mode payment](https://razorpay.com/docs/payments/payments/test-card-details/).
4. Return to the workspace. It polls while the webhook is pending.
5. Confirm the case reads `RECOVERED`, ₹50,000 recovered, and one captured payment in the ledger.

The callback URL only returns the browser to the workspace. It never changes case state. Only a valid `payment_link.paid` webhook can record money or mark the case recovered.

## Commands

```bash
bun dev                 # local development
bun run build           # production build
bun run lint            # ESLint
bun run typecheck       # TypeScript without emit
bun test                # unit tests
bun run simulate --cases 1000 --days 30 --seed 42
bun run simulate --strategy finance-age-bucket --contact-capacity 25 --review-capacity 5
bun run simulate --strategy razorpay-native-reminders --contact-capacity 25 --review-capacity 5
bun run simulate --strategy no-intervention --contact-capacity 25 --review-capacity 5
bun run simulate --compare --cases 1000 --days 30 --seed 42 --contact-capacity 25 --review-capacity 5
bun run db:generate     # generate a migration from the schema
bun run db:migrate      # apply migrations
bun run db:seed         # idempotently create the Milestone 1 fixture
```

Database integration tests are opt-in so the normal unit suite does not mutate a developer database. Point `TEST_DATABASE_URL` at a migrated disposable PostgreSQL database:

```bash
TEST_DATABASE_URL=postgresql://recovery:recovery@localhost:5432/recovery \
  bun run test:integration
```

## API surface

- `GET /api/recovery-cases/:id` — current local case and captured payments
- `POST /api/recovery-cases/:id/payment-link` — create or return the case’s existing Test Mode Payment Link
- `POST /api/webhooks/razorpay` — verify and process Razorpay webhook events

The Razorpay integration follows the current [Payment Link creation API](https://razorpay.com/docs/api/payments/payment-links/create-standard/), [Payment Link webhook payload](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=IN), and [webhook signature/idempotency guidance](https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN).
