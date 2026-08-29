---
name: recovery-evaluation-judge-critique
description: Critique substantial feature proposals for this AI Revenue Recovery hackathon project before implementation. Use when a feature could materially affect recovery strategy, AI decisions, evaluation, metrics, workflows, or the live demo; skip trivial refactors, styling-only changes, and small bug fixes.
---

# Recovery Evaluation Judge Critique

Evaluate proposed features like a skeptical Razorpay hackathon judge before substantial implementation begins. Optimize for:

1. credible revenue impact,
2. strong differentiation,
3. measurability,
4. judge defensibility,
5. hackathon scope discipline.

Produce a short critique that improves the decision, not a general software-engineering review.

## Project Lens

This project is an AI B2B receivables recovery system in the AI Revenue Recovery track:

```text
Overdue receivable
→ recovery case
→ intervention decision
→ bounded action
→ customer response or payment
→ Razorpay event
→ recovery state update
→ measured money recovered
```

The strongest story connects an intervention to credible incremental recovery across a batch while showing bounded workflows, stopping rules, compliant escalation, and auditability.

## When to Run

Run before implementing a substantial feature involving recovery strategies, AI decision logic, promise-to-pay, communication, retries, prioritization or risk scoring, dashboards, recovery metrics, customer simulation, batch evaluation, escalation, or agent workflows.

Do not run for trivial refactors, styling-only changes, documentation cleanup, or small bug fixes that do not change the product, evaluation, or demo story.

## Critique

### Revenue mechanism and track relevance

Explain how the feature could change recovered money. Distinguish a core recovery capability from a nice demonstration feature.

Ask:

- What decision, action, or outcome changes because this exists?
- Does it increase collection probability, speed recovery, reduce wasted interventions, improve stopping behavior, or strengthen compliance?
- Can the effect be tied to recovered revenue?
- Would judges understand why it matters?

Technical sophistication without a visible recovery mechanism is weak hackathon value.

### Counterfactual and baseline

Do not treat total recovered money as impact caused by the system. Define what would likely have happened without the proposed feature.

Prefer a defensible comparison such as:

- no intervention,
- a fixed reminder schedule,
- simple deterministic rules,
- existing merchant behavior,
- existing Razorpay behavior where applicable.

Measure incremental recovery where possible:

```text
incremental recovery
= recovered with proposed system
- recovered with baseline
```

Ask whether the same customers could have paid without the agent and whether both strategies were evaluated on comparable receivables and customer conditions.

### Evidence provenance

Label each part of the evaluation separately:

- actual Razorpay Test Mode transactions,
- synthetic receivable data,
- simulated customer responses,
- measured agent decisions and outcomes,
- assumptions used to connect simulation to recovery claims.

Never imply that simulated outcomes are real merchant recoveries. Test Mode proves integration behavior, not real-world causal impact. Synthetic benchmarks can support a hackathon claim when their construction, baseline, and assumptions are explicit.

Reject claims such as:

> The agent recovered ₹8 lakh.

when a simulator merely generated ₹8 lakh of successful payments.

Prefer:

> In our synthetic benchmark, the agent recovered ₹8 lakh versus ₹5.6 lakh using the fixed baseline strategy, giving ₹2.4 lakh of simulated incremental recovery.

State the assumptions required for any headline number, including payment probabilities, customer behavior, assignment to strategies, and attribution of payment to an intervention.

### Differentiation and Razorpay overlap

Determine whether Razorpay already provides the proposed capability. If Razorpay supplies the primitive, explain what recovery orchestration or intelligence this project adds.

A feature is weak when it merely wraps existing Razorpay functionality. It is stronger when the application decides when and why to use that functionality, applies guardrails and stopping rules, and measures incremental results.

When the answer depends on current Razorpay product behavior, use the project's Razorpay integration research workflow before making the overlap claim.

### Demo value and scope

Ask:

- Can judges see the feature's effect in a short live demo?
- Can the demo connect an input, decision, bounded action, Razorpay event, and recovery outcome?
- Does it expose an audit trail or explain why the action occurred?
- Is the value large enough to justify implementation and demo time?
- Would a simpler feature or evaluation tell the story more credibly?

Prefer simple, defensible evaluation over complicated metrics that obscure assumptions or causality.

## Required Output

Before implementation, produce:

```yaml
Feature: ...
Track relevance: CORE | SUPPORTING | WEAK
Expected revenue impact: ...
How impact can be measured: ...
Baseline: ...
Evidence:
  Razorpay Test Mode: ...
  Synthetic receivables: ...
  Simulated customer behavior: ...
  Measured agent outcomes: ...
  Assumptions: ...
Razorpay overlap: ...
Demo value: HIGH | MEDIUM | LOW
Evaluation risks:
  - ...
Likely judge challenge: ...
Recommendation: BUILD | MODIFY | DEFER | DROP
Reason: ...
```

Keep the critique brief. Expand only when a material uncertainty affects the recommendation.

## Recommendation Standard

- `BUILD`: central to the track, visibly useful, measurable against a credible baseline, and feasible within the hackathon.
- `MODIFY`: valuable idea, but its scope, differentiation, measurement, or demo must change first.
- `DEFER`: plausible future value, but insufficient impact or evidence for current hackathon priorities.
- `DROP`: duplicates existing capability, lacks a credible recovery mechanism, cannot support an honest claim, or distracts from the core story.

If the recommendation is not `BUILD`, identify the smallest change that could improve it. Surface `DEFER` or `DROP` clearly rather than silently spending hackathon time on it.

## Definition of Done

The critique is complete when it states:

1. how the feature could affect revenue recovery,
2. the counterfactual baseline,
3. whether the metric is total or incremental recovery,
4. the provenance of every material evaluation input and outcome,
5. Razorpay overlap and project differentiation,
6. visible demo value,
7. the strongest likely judge objection,
8. a clear build decision.
