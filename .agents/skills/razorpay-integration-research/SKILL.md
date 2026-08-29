---
name: razorpay-integration-research
description: Research and validate Razorpay integrations for this revenue-recovery project. Use before researching, implementing, or significantly changing Razorpay APIs, SDKs, webhooks, payment flows, or Test Mode behavior.
---

# Razorpay Integration Research

Verify Razorpay capabilities and contracts before implementation. The goal is to use the correct Razorpay primitive, avoid duplicating built-in functionality, and keep financial behavior defensible for the Razorpay hackathon.

## Project Boundary

This project targets B2B overdue-receivables recovery under the AI Revenue Recovery theme.

- Razorpay owns payment and collection infrastructure.
- Our application owns recovery cases, workflow, strategy, stopping rules, audit history, and measured recovery.
- AI may recommend recovery actions, but it must not determine financial truth.

Keep Razorpay payment state separate from application recovery state. For example, a paid Payment Link may contribute to a `RECOVERED` case, but those are different domain facts.

## Routing

Use this skill when the task asks what Razorpay supports, which product or object to use, or how to integrate Razorpay behavior.

- For research or design questions, finish with a recommendation and do not implement unless requested.
- For implementation requests, complete the integration check below before changing substantial Razorpay code.
- For small fixes whose existing contract is already documented in the project, verify only the assumptions affected by the change.

Do not rely on remembered product or API behavior when current official documentation can be checked.

## Source Priority

Use sources in this order:

1. Current official Razorpay documentation and API references.
2. Official Razorpay SDK repositories for SDK-specific behavior.
3. Razorpay Dashboard behavior for manually configured features.
4. Secondary sources only when official sources do not answer the question.

If current documentation conflicts with project code, flag the discrepancy before changing behavior. Never let a secondary source silently override official documentation.

## Integration Check

Cover the sections relevant to the task. Keep the result concise, but do not omit a safety-critical unknown.

### 1. Business requirement and existing capability

State the merchant need without assuming an endpoint or product. Determine whether Razorpay:

- fully solves it,
- provides the primitive while our application owns orchestration,
- provides only part of it, or
- does not appear to support it.

Do not reimplement a Razorpay feature merely to enlarge the project. Explain the application-level gap and what makes the project meaningfully different.

### 2. Correct Razorpay primitive

Identify the appropriate product or object, such as a Payment, Order, Payment Link, Invoice, Subscription, or webhook event. Explain why it fits and, when ambiguous, why plausible alternatives do not.

### 3. Test Mode

Verify whether every required behavior can be demonstrated in Test Mode. Classify it as:

- `TESTABLE`
- `PARTIALLY TESTABLE`
- `SIMULATION REQUIRED`
- `LIVE-ONLY / BLOCKED`
- `UNKNOWN`

Check relevant limitations, payment-method availability, success or failure simulation, webhook delivery, account activation or KYC requirements, and differences from Live Mode.

Distinguish actual Razorpay Test Mode evidence from synthetic customer behavior and simulated business outcomes.

### 4. API and SDK contract

Before coding, verify the relevant:

- endpoint or SDK method,
- authentication requirements,
- required request fields and validation constraints,
- currency units,
- identifiers, timestamps, and correlation metadata,
- response fields the application needs,
- failure responses the application must handle,
- product limits or deprecations.

Persist only the stable external identifiers and business data the application needs. Keep credentials server-side, store secrets in environment variables, and never expose or log them.

### 5. Webhooks and financial confirmation

When asynchronous state matters, verify:

- exact event names and emission conditions,
- payload entities and correlation fields,
- signature algorithm and raw-body requirements,
- retry, duplicate, and ordering behavior.

Treat webhooks as untrusted until their signature is verified. Design financial mutations to be idempotent because an event may be duplicated, delayed, or delivered out of order.

A frontend callback, redirect, or success page is not authoritative proof of payment unless the documented Razorpay flow provides server-side verification.

### 6. Correlation, state, and ownership

Define how a Razorpay entity maps to a recovery case using stable explicit identifiers. Prefer IDs such as payment, order, or Payment Link identifiers over matching on customer details or amount.

Document which responsibilities belong to:

- Razorpay,
- our application,
- the AI agent,
- deterministic policy,
- a human.

The application should normally calculate outstanding amounts, manage recovery state, decide contact or stopping behavior, and record recovery attribution. Razorpay supplies verified collection facts.

### 7. Hackathon differentiation and risks

Answer:

- What does our project add beyond Razorpay's existing functionality?
- Can the required behavior actually be demonstrated?
- How is a payment correlated to the correct recovery case?
- How do we know the recovery action contributed to the outcome?
- What assumptions remain unverified?

Recommend `BUILD`, `MODIFY`, `DEFER`, or `DROP`.

## Required Pre-Implementation Note

Before substantial integration changes, provide:

```markdown
## Razorpay Integration Check

### Business requirement
...

### Existing Razorpay capability and project gap
...

### Razorpay primitive
...

### Official sources
- ...

### Test Mode
Status: TESTABLE | PARTIALLY TESTABLE | SIMULATION REQUIRED | LIVE-ONLY / BLOCKED | UNKNOWN
Limitations: ...

### API and webhooks
Contract: ...
Verification and idempotency: ...

### Correlation and ownership
...

### Risks
- ...

### Recommendation
BUILD | MODIFY | DEFER | DROP
Reason: ...
```

For a narrow change, this note may be only a few sentences. Expand it when the integration is new, ambiguous, or financially sensitive.

## Non-Negotiable Implementation Invariants

- Represent money as integer smallest-currency units; never use floating point. Use explicit names such as `amountDuePaise`.
- Validate external input and handle Razorpay failures explicitly.
- Verify webhook authenticity before changing financial state.
- Make webhook-driven financial processing idempotent and prevent double counting.
- Correlate entities with stable explicit identifiers.
- Keep Razorpay state distinct from recovery-domain state.
- Treat verified server-side payment information as financial truth, not AI output or frontend state.
- Add required secret placeholders to `.env.example`, but never commit credentials.
- Do not generalize abstractions to Razorpay products the project does not use.
- Do not present Test Mode or synthetic evidence as proof of Live Mode behavior.

## Definition of Done

A Razorpay integration is sufficiently understood when we can explain:

1. Why this Razorpay primitive is appropriate.
2. What Razorpay already provides and what our application adds.
3. Whether the required behavior works in Test Mode.
4. Which current official sources verify the contract.
5. How authentication, correlation, and financial-event verification work.
6. How duplicate processing and double counting are prevented.
7. Which risks or unknowns remain.
