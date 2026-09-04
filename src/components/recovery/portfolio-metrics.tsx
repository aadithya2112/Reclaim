import type { RecoveryDashboardData } from "@/lib/recovery-dashboard-types";
import { MoneyValue } from "@/components/app/money-value";

function Metric({ label, children, note, featured }: { label: string; children: React.ReactNode; note: string; featured?: boolean }) {
  return <div className="min-w-0 border-b border-border px-4 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"><p className="text-xs text-muted-foreground">{label}</p><div className={featured ? "mt-2 text-3xl font-semibold tracking-[-0.04em]" : "mt-2 text-2xl font-medium tracking-[-0.04em]"}>{children}</div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{note}</p></div>;
}

export function PortfolioMetrics({ data }: { data: RecoveryDashboardData }) {
  const recoup = data.strategies.find((item) => item.strategy === "recoup-hybrid");
  const native = data.strategies.find((item) => item.strategy === "razorpay-native-reminders");
  const incremental = (recoup?.simulatedRecoveredPaise ?? 0) - (native?.simulatedRecoveredPaise ?? 0);
  return <section className="mt-8 grid border-y border-border sm:grid-cols-2 lg:grid-cols-4" aria-label="Portfolio summary">
    <Metric label="Recovered above native baseline" featured note="Paired simulated difference, not causal uplift"><MoneyValue paise={incremental} compact signed /></Metric>
    <Metric label="Total simulated recovery" note={`${Math.round((recoup?.simulatedRecoveryRate ?? 0) * 100)}% of synthetic starting outstanding`}><MoneyValue paise={recoup?.simulatedRecoveredPaise ?? 0} compact /></Metric>
    <Metric label="Starting outstanding" note={`${data.portfolio.cases} synthetic cases · ${data.portfolio.virtualDays} virtual days`}><MoneyValue paise={data.portfolio.startingOutstandingPaise} compact /></Metric>
    <Metric label="Day-zero capacity" note={`${data.dailyCapacity.reviewsUsed}/${data.dailyCapacity.reviewLimit} simulated human reviews used`}><span className="tabular-nums">{data.dailyCapacity.contactsUsed}/{data.dailyCapacity.contactLimit}</span></Metric>
  </section>;
}
