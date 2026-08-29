# Recoup — Razorpay Receivables Recovery Spike

Milestone 1 proves a single recovery loop: a local overdue invoice becomes a Razorpay Test Mode Payment Link, a signed Razorpay webhook records the captured payment, and the application-owned recovery case becomes `RECOVERED`.

## What is included

- Bun + Next.js App Router + TypeScript
- PostgreSQL + Drizzle ORM
- Razorpay Payment Links through the REST API
- Raw-body HMAC webhook verification and duplicate-delivery protection
- One idempotent synthetic recovery case (`INV-001`, ₹50,000)
- An operator workspace that polls while the verified webhook is pending

AI decisions, communication workflows, partial payments, authentication, and production deployment are intentionally out of scope.

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
