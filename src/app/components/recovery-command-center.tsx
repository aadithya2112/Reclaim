"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RecoveryDashboardControls, RecoveryDashboardData, RecoveryQueueCase } from "@/lib/recovery-dashboard-types";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-IN");
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 1 });
type ComparedStrategy = "recoup-hybrid" | "razorpay-native-reminders" | "finance-age-bucket";

const SERIES: Record<ComparedStrategy, { label: string; className: string }> = {
  "recoup-hybrid": { label: "Recoup", className: "frontier-recoup" },
  "razorpay-native-reminders": { label: "Native reminders", className: "frontier-native" },
  "finance-age-bucket": { label: "Finance SOP", className: "frontier-finance" },
};

const scenarioLabels: Record<RecoveryDashboardControls["scenario"], string> = {
  standard: "Standard",
  conservative: "Conservative",
  adversarial: "Adversarial",
  "relationship-sensitive": "Relationship-sensitive",
};

const amount = (paise: number) => money.format(paise / 100);
const compactAmount = (paise: number) => compactMoney.format(paise / 100);
const actionLabel = (action: string) => action.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");

function FrontierChart({ data, selectedStrategy, onSelectStrategy }: { data: RecoveryDashboardData; selectedStrategy: ComparedStrategy; onSelectStrategy: (strategy: ComparedStrategy) => void }) {
  const width = 760;
  const height = 286;
  const left = 62;
  const right = 24;
  const top = 22;
  const bottom = 48;
  const maxContacts = Math.max(1, ...data.frontier.map((point) => point.contacts));
  const maxRecovery = Math.max(1, ...data.frontier.map((point) => point.simulatedRecoveredPaise));
  const x = (value: number) => left + (value / maxContacts) * (width - left - right);
  const y = (value: number) => top + (1 - value / maxRecovery) * (height - top - bottom);
  const series = Object.keys(SERIES) as ComparedStrategy[];
  const noIntervention = data.strategies.find((item) => item.strategy === "no-intervention")?.simulatedRecoveredPaise ?? 0;
  const ticks = [0, .25, .5, .75, 1];
  return (
    <div className="frontier-chart-wrap">
      <svg className="frontier-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Simulated recovery plotted against total customer contacts for three strategies">
        {ticks.map((tick) => <g key={tick}>
          <line x1={left} x2={width - right} y1={y(maxRecovery * tick)} y2={y(maxRecovery * tick)} className="frontier-gridline" />
          <text x={left - 10} y={y(maxRecovery * tick) + 4} textAnchor="end">{compactAmount(maxRecovery * tick)}</text>
          <text x={x(maxContacts * tick)} y={height - 24} textAnchor="middle">{integer.format(Math.round(maxContacts * tick))}</text>
        </g>)}
        <line x1={left} x2={width - right} y1={y(noIntervention)} y2={y(noIntervention)} className="frontier-no-action" />
        <text x={width - right} y={y(noIntervention) - 7} textAnchor="end" className="frontier-no-action-label">No-intervention recovery</text>
        {series.map((strategy) => {
          const points = data.frontier.filter((point) => point.strategy === strategy).sort((a, b) => a.contacts - b.contacts);
          return <g key={strategy} className={`${SERIES[strategy].className} ${selectedStrategy === strategy ? "frontier-series-selected" : ""}`}>
            <polyline points={points.map((point) => `${x(point.contacts)},${y(point.simulatedRecoveredPaise)}`).join(" ")} className="frontier-line" />
            {points.map((point) => {
              const current = point.dailyContactLimit === data.controls.dailyContactLimit;
              return <circle key={`${strategy}-${point.dailyContactLimit}`} cx={x(point.contacts)} cy={y(point.simulatedRecoveredPaise)} r={current ? 6 : 4} className={current ? "frontier-point-current" : "frontier-point"} tabIndex={0} aria-label={`${SERIES[strategy].label}, daily contact limit ${point.dailyContactLimit}, ${amount(point.simulatedRecoveredPaise)} simulated recovery, ${point.contacts} contacts, ${point.humanReviews} reviews`} onClick={() => onSelectStrategy(strategy)} />;
            })}
          </g>;
        })}
        <text x={(left + width - right) / 2} y={height - 3} textAnchor="middle" className="frontier-axis-title">Customer contacts over {data.portfolio.virtualDays} days</text>
        <text transform={`translate(14 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className="frontier-axis-title">Simulated recovery</text>
      </svg>
      <div className="frontier-legend" aria-label="Strategy legend">
        {series.map((strategy) => <button key={strategy} type="button" className={selectedStrategy === strategy ? "is-selected" : ""} onClick={() => onSelectStrategy(strategy)} aria-pressed={selectedStrategy === strategy}><span className={SERIES[strategy].className} />{SERIES[strategy].label}</button>)}
      </div>
    </div>
  );
}

function QueueRow({ item, active, onSelect }: { item: RecoveryQueueCase; active: boolean; onSelect: () => void }) {
  const queueClass = item.queue.toLowerCase().replace("_", "-");
  return <button className={`queue-row ${active ? "is-active" : ""}`} type="button" onClick={onSelect}>
    <span className={`queue-index queue-index--${queueClass}`}>{item.queue === "ACT_NOW" ? "A" : item.queue === "DEFERRED" ? "D" : "W"}</span>
    <span className="queue-identity"><strong>{item.invoiceId}</strong><small>{item.daysOverdue}d overdue · {item.riskSegment.toLowerCase()} risk</small></span>
    <span className="queue-action"><strong>{actionLabel(item.executedAction)}</strong><small>{item.priorityScore !== undefined ? `Priority ${Math.round(item.priorityScore)}` : "Policy protected"}</small></span>
    <span className="queue-amount">{compactAmount(item.outstandingPaise)}</span><span className="queue-arrow" aria-hidden="true">→</span>
  </button>;
}

function DecisionInspector({ item }: { item: RecoveryQueueCase | undefined }) {
  if (!item) return <aside className="decision-inspector inspector-empty"><span>Choose a recovery case to replay its decision.</span></aside>;
  const queueClass = item.queue.toLowerCase().replace("_", "-");
  const caseDifference = item.nativeBaseline.simulatedDifferencePaise;
  return <aside className="decision-inspector" aria-label={`Decision replay for ${item.invoiceId}`}>
    <div className="inspector-topline"><span>Decision replay</span><span>{item.id}</span></div>
    <div className="inspector-title"><div><p>{item.invoiceId}</p><h2>{compactAmount(item.outstandingPaise)}</h2></div><span className={`queue-badge queue-badge--${queueClass}`}>{item.queue.replace("_", " / ")}</span></div>
    <dl className="inspector-facts"><div><dt>Overdue</dt><dd>{item.daysOverdue} days</dd></div><div><dt>Risk</dt><dd>{item.riskSegment}</dd></div><div><dt>Confidence</dt><dd>{item.confidence !== undefined ? percent.format(item.confidence) : "Rules"}</dd></div></dl>
    <section className="inspector-block"><p className="inspector-label">Proposed action</p><strong className="inspector-action-name">{actionLabel(item.proposedAction)}</strong><p>{item.reason}</p></section>
    <section className="inspector-block inspector-policy"><div className="policy-head"><span className={item.policyRule ? "policy-dot policy-dot--blocked" : "policy-dot"} /><div><p className="inspector-label">Deterministic policy</p><strong>{item.policyRule ?? "ACTION_ALLOWED"}</strong></div></div><p>{item.policyReason}</p></section>
    <section className="inspector-block baseline-comparison"><p className="inspector-label">Paired case attribution</p><div><span>Recoup</span><strong>{actionLabel(item.proposedAction)}</strong><small>{amount(item.nativeBaseline.recoupRecoveredPaise)} simulated recovery</small></div><div><span>Native baseline</span><strong>{actionLabel(item.nativeBaseline.proposedAction)}</strong><small>{amount(item.nativeBaseline.nativeRecoveredPaise)} simulated recovery</small></div><p className={caseDifference >= 0 ? "case-difference positive" : "case-difference negative"}>{caseDifference >= 0 ? "+" : ""}{amount(caseDifference)} paired simulated difference</p></section>
    <section className="inspector-block"><p className="inspector-label">Observable factors</p><div className="factor-list">{item.factors.slice(0, 5).map((factor) => <div key={factor.signal}><span>{factor.signal.replaceAll("_", " ")}</span><strong>{String(factor.value)}</strong><i className={`factor-effect factor-effect--${factor.effect.toLowerCase()}`} /></div>)}</div></section>
    <details className="timeline-disclosure"><summary>Audit timeline <span>{item.timeline.length}</span></summary><ol>{item.timeline.map((event, index) => <li key={`${event.day}-${event.type}-${index}`}><span>Day {event.day}</span><div><strong>{event.type.replaceAll("_", " ")}</strong><p>{event.reason}</p></div></li>)}</ol></details>
  </aside>;
}

export function RecoveryCommandCenter() {
  const [controls, setControls] = useState<RecoveryDashboardControls>({ scenario: "standard", dailyContactLimit: 20, dailyHumanReviewLimit: 4 });
  const [data, setData] = useState<RecoveryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<"actNow" | "protected" | "deferred">("actNow");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ComparedStrategy>("recoup-hybrid");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCurrent() {
      try {
        const params = new URLSearchParams({ scenario: controls.scenario, contacts: String(controls.dailyContactLimit), reviews: String(controls.dailyHumanReviewLimit) });
        const response = await fetch(`/api/recovery-frontier?${params}`, { signal: controller.signal });
        const body = await response.json() as { data?: RecoveryDashboardData; error?: string };
        if (!response.ok || !body.data) throw new Error(body.error ?? "Recovery Frontier could not be generated");
        setData(body.data);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Recovery Frontier could not be generated");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadCurrent();
    return () => controller.abort();
  }, [controls, retryNonce]);
  const queueItems = data?.queues[queue] ?? [];
  const selectedCase = queueItems.find((item) => item.id === selectedCaseId) ?? queueItems[0];
  const recoup = data?.strategies.find((item) => item.strategy === "recoup-hybrid");
  const native = data?.strategies.find((item) => item.strategy === "razorpay-native-reminders");
  const highlighted = data?.strategies.find((item) => item.strategy === selectedStrategy);
  const incremental = (recoup?.simulatedRecoveredPaise ?? 0) - (native?.simulatedRecoveredPaise ?? 0);

  return <main className="command-shell">
    <header className="command-topbar"><a className="brand" href="#top" aria-label="Recoup command center"><span className="brand-mark">R</span><span>recoup</span></a><nav className="command-nav" aria-label="Primary navigation"><a className="is-active" href="#frontier">Command center</a><a href="#queue">Decision queue</a><a href="#evidence">Evidence</a><Link href="/collection">Test collection ↗</Link></nav><div className="command-environment"><span />Development benchmark</div></header>
    <div className="command-layout" id="top">
      <div className={`command-workspace ${loading && data ? "is-refreshing" : ""}`}>
        <section className="command-heading">
          <div><p className="eyebrow">Recovery portfolio · {data?.portfolio.cases ?? 96} synthetic cases</p><h1>Command center</h1><p>Allocate today’s constrained recovery capacity and inspect every decision.</p></div>
          <div className="command-controls">
            <label><span>Scenario</span><select value={controls.scenario} onChange={(event) => { setLoading(true); setError(null); setControls((current) => ({ ...current, scenario: event.target.value as RecoveryDashboardControls["scenario"] })); }}>{Object.entries(scenarioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Daily contacts</span><select value={controls.dailyContactLimit} onChange={(event) => { setLoading(true); setError(null); setControls((current) => ({ ...current, dailyContactLimit: Number(event.target.value) })); }}>{[5, 10, 20, 30, 40].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Daily reviews</span><select value={controls.dailyHumanReviewLimit} onChange={(event) => { setLoading(true); setError(null); setControls((current) => ({ ...current, dailyHumanReviewLimit: Number(event.target.value) })); }}>{[0, 2, 4, 6, 8, 10].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
        </section>
        {error && !data ? <div className="command-error"><strong>Benchmark unavailable</strong><span>{error}</span><button type="button" onClick={() => { setLoading(true); setError(null); setRetryNonce((value) => value + 1); }}>Retry</button></div> : null}
        {!data ? <div className="command-loading"><span /><strong>Generating paired benchmark</strong><small>Same portfolio, policy, capacity, and frozen outcome bank.</small></div> : <>
          <section className="command-metrics" aria-label="Portfolio summary">
            <div><span>Starting outstanding</span><strong>{compactAmount(data.portfolio.startingOutstandingPaise)}</strong><small>{integer.format(data.portfolio.cases)} cases · {data.portfolio.virtualDays} virtual days</small></div>
            <div><span>Recoup simulated recovery</span><strong>{compactAmount(recoup?.simulatedRecoveredPaise ?? 0)}</strong><small>{percent.format(recoup?.simulatedRecoveryRate ?? 0)} of starting outstanding</small></div>
            <div><span>Difference vs native</span><strong className={incremental >= 0 ? "positive" : "negative"}>{incremental >= 0 ? "+" : ""}{compactAmount(incremental)}</strong><small>Paired simulated difference—not causal uplift</small></div>
            <div><span>Today’s capacity</span><strong>{data.dailyCapacity.contactsUsed}/{data.dailyCapacity.contactLimit}</strong><small>{data.dailyCapacity.reviewsUsed}/{data.dailyCapacity.reviewLimit} human reviews used</small></div>
          </section>
          <section className="frontier-section" id="frontier">
            <div className="section-heading command-section-heading"><div><p className="eyebrow">Recovery / burden trade-off</p><h2>Recovery Frontier</h2></div><div className="evidence-stamp"><span /> Paired synthetic</div></div>
            <p className="section-note">Each point reruns the same strategy at a different daily contact ceiling. Human-review capacity remains fixed at {data.controls.dailyHumanReviewLimit} per day.</p>
            <FrontierChart data={data} selectedStrategy={selectedStrategy} onSelectStrategy={setSelectedStrategy} />
            <div className="strategy-detail"><div><span>Selected strategy</span><strong>{highlighted?.label}</strong></div><div><span>Simulated recovery</span><strong>{compactAmount(highlighted?.simulatedRecoveredPaise ?? 0)}</strong></div><div><span>Contacts / reviews</span><strong>{integer.format(highlighted?.contacts ?? 0)} / {integer.format(highlighted?.humanReviews ?? 0)}</strong></div><div><span>Fully recovered</span><strong>{integer.format(highlighted?.fullyRecoveredCases ?? 0)} cases</strong></div></div>
            <div className="development-range"><span>Development-seed range · {data.developmentRange.seeds.join(", ")}</span><strong>Recoup {compactAmount(data.developmentRange.recoupRecoveredPaise.minimum)}–{compactAmount(data.developmentRange.recoupRecoveredPaise.maximum)}</strong><strong>Native {compactAmount(data.developmentRange.nativeRecoveredPaise.minimum)}–{compactAmount(data.developmentRange.nativeRecoveredPaise.maximum)}</strong><strong>Difference {compactAmount(data.developmentRange.simulatedDifferencePaise.minimum)}–{compactAmount(data.developmentRange.simulatedDifferencePaise.maximum)}</strong><small>Held-out seeds remain untouched.</small></div>
          </section>
          <section className="queue-section" id="queue">
            <div className="section-heading command-section-heading"><div><p className="eyebrow">Day zero allocation</p><h2>Decision queue</h2></div><span>{data.dailyCapacity.protectedDecisions} protected decisions consume no capacity</span></div>
            <div className="queue-tabs" role="tablist" aria-label="Decision queues">
              {([['actNow', 'Act now', data.queues.actNow.length], ['protected', 'Wait / protected', data.queues.protected.length], ['deferred', 'Deferred', data.queues.deferred.length]] as const).map(([value, label, count]) => <button key={value} type="button" role="tab" aria-selected={queue === value} onClick={() => { setQueue(value); setSelectedCaseId(null); }}>{label}<span>{count}</span></button>)}
            </div>
            <div className="queue-list">{queueItems.length ? queueItems.map((item) => <QueueRow key={item.id} item={item} active={item.id === selectedCase?.id} onSelect={() => setSelectedCaseId(item.id)} />) : <div className="queue-empty">No cases in this queue at the selected capacity.</div>}</div>
          </section>
          <section className="evidence-section" id="evidence">
            <div><p className="eyebrow">Evidence boundary</p><h2>What this screen proves</h2></div>
            <div className="evidence-grid"><div><span className="evidence-dot evidence-dot--synthetic" /><strong>Synthetic receivables</strong><p>Controlled invoice values, aging, histories, and capacity constraints.</p></div><div><span className="evidence-dot evidence-dot--measured" /><strong>Measured decisions</strong><p>Proposals, policy outcomes, queue allocation, and deterministic hashes.</p></div><div><span className="evidence-dot evidence-dot--assumed" /><strong>Simulated outcomes</strong><p>Customer response and payment behavior under disclosed scenario assumptions.</p></div><div><span className="evidence-dot evidence-dot--test" /><strong>Razorpay not invoked here</strong><p>Test Mode collection remains a separate integration proof.</p></div></div>
            <details className="hash-disclosure"><summary>Reproducibility hashes</summary><code>Decision cache · {data.evidence.decisionCacheHash}</code><code>Outcome bank · {data.evidence.outcomeBankHash}</code></details>
          </section>
        </>}
      </div>
      <DecisionInspector item={selectedCase} />
    </div>
  </main>;
}
