# Shadcn UI redesign implementation plan

## Decision

Implement the visual direction in `/concept` across the real command center and decision replay. Preserve the existing recovery logic, APIs, auditability, and evidence provenance. Treat the concept as a visual reference rather than production code to copy wholesale.

## Design direction

### Visual thesis

A calm, modern financial operations workspace: warm white surfaces, mist neutrals, teal as the single product accent, generous spacing, and dense information only where an operator needs it.

### Content plan

1. Shared header: Recoup identity, primary navigation, environment label, and one page-level action.
2. Orientation: page title, one-line scope description, and compact scenario controls.
3. Money-first summary: incremental simulated recovery first, then total recovery, starting outstanding, and capacity.
4. Primary work surface: recovery frontier followed by the decision queue.
5. Secondary context: selected-case inspector with recommendation, policy state, attribution, and audit details.
6. Evidence boundary: a compact but explicit explanation of synthetic, simulated, measured, and Razorpay Test Mode evidence.

### Interaction thesis

- Changing scenario or capacity keeps the current data visible with a subtle loading veil and skeleton only on first load.
- Selecting a queue row updates the inspector with a short opacity/translate transition and a clear selected state.
- Frontier points expose values on focus/hover and selecting a strategy updates the summary without visual noise.

## Non-negotiable product constraints

- Never present simulated recovery as real recovered money.
- Keep “paired simulated difference, not causal uplift” adjacent to the headline incremental number.
- Keep synthetic benchmark evidence separate from Razorpay Test Mode evidence.
- Only a signed Razorpay webhook may be shown as verified payment truth.
- Preserve policy blocks, approval requirements, contact limits, promise protection, hashes, and the append-only timeline.
- Do not alter API behavior, recovery calculations, simulation seeds, or database writes as part of the redesign.

## Component architecture

### Shared application shell

Create reusable components under `src/components/app/`:

- `app-header.tsx`: logo, route navigation, environment badge, mobile navigation.
- `page-heading.tsx`: page title, supporting context, and action/control slot.
- `evidence-badge.tsx`: consistent visual vocabulary for synthetic, simulated, measured, Test Mode, and verified states.
- `money-value.tsx`: INR formatting, compact formatting, positive/negative state, and provenance note.
- `empty-state.tsx` and `error-state.tsx`: accessible reusable states.

Use the preset tokens from `components.json`. Add shadcn primitives only when used: `chart`, `skeleton`, `alert`, `tooltip`, `collapsible`, `textarea`, and `sheet` for mobile navigation/inspection. Install the chart integration with `bunx --bun shadcn@latest add chart`; use its Recharts-based `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, and chart configuration rather than maintaining a bespoke SVG renderer.

### Command center

Split `recovery-command-center.tsx` into focused components under `src/components/recovery/`:

- `recovery-overview.tsx`: owns fetch state, controls, selected queue, selected case, and selected strategy.
- `portfolio-controls.tsx`: shadcn `Select` controls with explicit labels.
- `portfolio-metrics.tsx`: four-metric bordered strip, not four floating cards.
- `recovery-frontier.tsx`: render the frontier with shadcn chart primitives and Recharts `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `ReferenceLine`, and interactive points inside one shadcn `Card`.
- `strategy-summary.tsx`: compact comparison beneath or beside the frontier.
- `recovery-queue.tsx`: shadcn `Tabs` and `Table`, responsive row layout, keyboard-selectable cases.
- `decision-inspector.tsx`: sticky desktop card and mobile `Sheet`; preserve policy, paired attribution, factors, and timeline.
- `evidence-boundary.tsx`: concise overview with expandable assumptions, limitations, and reproducibility hashes.

The existing `/api/recovery-frontier` request and `RecoveryDashboardData` types remain unchanged.

### Decision replay and collection

Recompose `recovery-workspace.tsx` as a guided operational workspace rather than three equal presentation columns:

- `replay-header.tsx`: invoice, authoritative balance, verified progress, and Test Mode label.
- `customer-message-panel.tsx`: shadcn `Textarea`, cached/live interpreter actions, and untrusted-input label.
- `proposal-panel.tsx`: extracted commitment, evidence spans, confidence, revision, and model provenance.
- `policy-approval-panel.tsx`: deterministic verdict, reasons, and bounded approval action.
- `razorpay-handoff.tsx`: locked, approved, checkout-ready, partially paid, and recovered states.
- `promise-and-queue-impact.tsx`: verified promise status and freed-capacity transition.
- `audit-timeline.tsx`: collapsible append-only event history.

Keep the existing action order and button names where possible so the demo narrative and end-to-end test remain stable.

## Implementation sequence

### Phase 1: foundation and safety baseline

1. Record desktop and mobile screenshots of `/` and `/collection` before replacement.
2. Run the current unit, integration, and end-to-end suites to establish a baseline.
3. Normalize global tokens so legacy `--muted` and `--accent` variables no longer conflict with shadcn tokens.
4. Reduce `globals.css` to resets, shadcn tokens, and genuinely global behavior; move page-specific styling into Tailwind classes/components.
5. Build the shared application header and evidence badge system.

### Phase 2: command center shell and summary

1. Replace the two existing navigation bars with the single header from option 1.
2. Rebuild the heading and controls using shadcn `Select` and `Button`.
3. Implement the money-first metric strip using live values from `RecoveryDashboardData`.
4. Add skeleton, error, retry, and refreshing states without clearing previously loaded data.

### Phase 3: frontier, queue, and inspector

1. Replace the existing hand-authored SVG with the shadcn chart integration backed by Recharts; keep the current data calculations and API response unchanged.
2. Map the frontier points into a stable Recharts dataset and configure one series per strategy through shadcn `ChartConfig` tokens.
3. Preserve strategy selection, current-capacity points, the no-intervention `ReferenceLine`, axes, keyboard access, and screen-reader labels.
4. Use `ChartTooltipContent` to show strategy, daily contact limit, simulated recovery, contacts, and human reviews without implying causal uplift.
5. Convert queues to shadcn `Tabs` and `Table` while preserving all three queue states.
6. Implement row selection and the desktop/mobile inspector.
7. Put deeper factors, paired attribution, timeline, development seed range, assumptions, and hashes behind clear disclosures rather than removing them.

### Phase 4: decision replay

1. Apply the shared shell to `/collection`.
2. Convert the current message → proposal → policy flow into a vertical, progressive sequence.
3. Preserve cached replay, live interpretation, approval, payment-link creation, recorded fallback, polling, and reset behavior.
4. Keep verified amounts and simulated fallback visually unmistakable.
5. Restyle promise protection, queue movement, and audit timeline with shared shadcn primitives.

### Phase 5: responsive behavior and polish

1. Validate 390 px, 768 px, 1024 px, and 1440 px layouts.
2. Use a mobile `Sheet` for navigation and selected-case details.
3. Ensure tables degrade into readable stacked rows rather than horizontal overflow where possible.
4. Add restrained transitions for loading, selection, disclosures, and state changes; honor `prefers-reduced-motion`.
5. Verify focus order, visible focus states, labels, contrast, touch targets, and screen-reader names.

### Phase 6: cleanup and verification

1. Update the Playwright test to use roles or stable test IDs instead of legacy CSS selectors such as `.after-grid`.
2. Add an end-to-end command-center test for controls, queue tabs, case selection, and evidence labels.
3. Run typecheck, lint, unit tests, integration tests, end-to-end tests, and production build.
4. Compare final desktop/mobile screenshots with `/concept` for hierarchy and spacing.
5. Remove obsolete legacy CSS and temporary concept routes only after visual sign-off.

## Acceptance criteria

- `/` matches option 1’s hierarchy and uses live dashboard data.
- `/collection` feels like the same product and preserves the full operational demo.
- A judge can identify the incremental simulated recovery, selected action, policy boundary, and evidence type within the first viewport or one deliberate interaction.
- All current recovery and Razorpay workflows behave identically.
- Loading, empty, error, blocked, approval-required, checkout-ready, partially-paid, and recovered states are designed and tested.
- Desktop and mobile layouts are usable without clipped controls or unreadable charts/tables.
- The Recovery Frontier uses shadcn chart components with Recharts and remains accurate, responsive, keyboard-accessible, and legible in tooltips.
- No simulated outcome is visually or verbally represented as verified recovery.
- Production build and all automated tests pass.

## Recommended delivery slices

1. Shared shell + command center summary.
2. Frontier + queue + inspector.
3. Decision replay + Razorpay handoff states.
4. Evidence disclosures + responsive/accessibility polish.
5. Test hardening + legacy cleanup.

Each slice should remain buildable and demoable so visual feedback can be incorporated without destabilizing the recovery logic.
