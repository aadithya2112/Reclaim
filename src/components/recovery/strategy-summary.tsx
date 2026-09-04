import type { RecoveryDashboardData } from "@/lib/recovery-dashboard-types";
import type { ComparedStrategy } from "@/components/recovery/recovery-frontier";
import { formatCompactMoney } from "@/components/app/money-value";

export function StrategySummary({ data, selectedStrategy }: { data: RecoveryDashboardData; selectedStrategy: ComparedStrategy }) {
  const selected = data.strategies.find((item) => item.strategy === selectedStrategy);
  return <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4" aria-live="polite">
    {[ ["Selected strategy", selected?.label ?? "—"], ["Simulated recovery", formatCompactMoney(selected?.simulatedRecoveredPaise ?? 0)], ["Contacts / reviews", `${(selected?.contacts ?? 0).toLocaleString("en-IN")} / ${(selected?.humanReviews ?? 0).toLocaleString("en-IN")}`], ["Fully recovered", String(selected?.fullyRecoveredCases ?? 0)] ].map(([label,value]) => <div key={label} className="bg-background p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}
  </div>;
}
