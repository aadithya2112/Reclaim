"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { RecoveryDashboardData } from "@/lib/recovery-dashboard-types";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/app/evidence-badge";
import { formatCompactMoney, formatMoney } from "@/components/app/money-value";

export type ComparedStrategy = "recoup-hybrid" | "razorpay-native-reminders" | "finance-age-bucket";
const strategies: ComparedStrategy[] = ["recoup-hybrid", "razorpay-native-reminders", "finance-age-bucket"];
const config = {
  "recoup-hybrid": { label: "Recoup", color: "var(--chart-1)" },
  "razorpay-native-reminders": { label: "Native reminders", color: "var(--chart-2)" },
  "finance-age-bucket": { label: "Finance SOP", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function RecoveryFrontier({ data, selectedStrategy, onSelectStrategy }: { data: RecoveryDashboardData; selectedStrategy: ComparedStrategy; onSelectStrategy: (strategy: ComparedStrategy) => void }) {
  const chartData = data.frontier.map((point) => ({ contacts: point.contacts, [point.strategy]: point.simulatedRecoveredPaise, strategy: point.strategy, dailyContactLimit: point.dailyContactLimit, humanReviews: point.humanReviews })).sort((a,b) => a.contacts - b.contacts);
  const noIntervention = data.strategies.find((item) => item.strategy === "no-intervention")?.simulatedRecoveredPaise ?? 0;
  return <Card id="frontier" className="shadow-none">
    <CardHeader className="border-b sm:grid-cols-[1fr_auto]"><div><CardTitle>Recovery vs customer contact</CardTitle><CardDescription className="mt-1">{data.portfolio.virtualDays}-day simulated outcome across the same receivables and frozen outcome bank.</CardDescription></div><EvidenceBadge kind="synthetic" className="mt-2 sm:mt-0">Paired synthetic</EvidenceBadge></CardHeader>
    <CardContent className="pt-5">
      <div className="mb-3 flex flex-wrap justify-end gap-1" aria-label="Strategy selection">{strategies.map((strategy) => <Button key={strategy} size="xs" variant={selectedStrategy === strategy ? "secondary" : "ghost"} aria-pressed={selectedStrategy === strategy} onClick={() => onSelectStrategy(strategy)}><i className="size-2 rounded-full" style={{ background: config[strategy].color }} />{config[strategy].label}</Button>)}</div>
      <ChartContainer config={config} className="h-[280px] w-full aspect-auto" role="img" aria-label="Simulated recovery plotted against total customer contacts for three strategies">
        <LineChart data={chartData} margin={{ left: 8, right: 16, top: 12, bottom: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="contacts" type="number" domain={[0, "dataMax"]} tickLine={false} axisLine={false} tickMargin={10} label={{ value: `Customer contacts over ${data.portfolio.virtualDays} days`, position: "insideBottom", offset: -4 }} height={44} />
          <YAxis type="number" tickFormatter={formatCompactMoney} tickLine={false} axisLine={false} width={62} />
          <ReferenceLine y={noIntervention} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "No intervention", fill: "var(--muted-foreground)", fontSize: 10, position: "insideTopRight" }} />
          <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltipContent labelFormatter={(_, payload) => { const point = payload[0]?.payload as { dailyContactLimit?: number; contacts?: number; humanReviews?: number } | undefined; return point ? `Limit ${point.dailyContactLimit}/day · ${point.contacts} contacts · ${point.humanReviews} reviews` : "Simulated recovery"; }} formatter={(value, name) => <div className="flex min-w-48 items-center justify-between gap-4"><span className="text-muted-foreground">{config[name as ComparedStrategy]?.label ?? name}</span><strong className="tabular-nums">{formatMoney(Number(value))}</strong></div>} />} />
          {strategies.map((strategy) => <Line key={strategy} dataKey={strategy} connectNulls type="monotone" stroke={`var(--color-${strategy})`} strokeWidth={selectedStrategy === strategy ? 3 : 1.75} strokeOpacity={selectedStrategy === strategy ? 1 : .48} dot={{ r: selectedStrategy === strategy ? 4 : 3, fill: "var(--background)", strokeWidth: 2 }} activeDot={{ r: 6, onClick: () => onSelectStrategy(strategy) }} onClick={() => onSelectStrategy(strategy)} />)}
        </LineChart>
      </ChartContainer>
      <p className="mt-3 text-[11px] text-muted-foreground">Focus or hover a point for daily limit, simulated recovery, contacts, and human reviews. Human-review capacity stays fixed at {data.controls.dailyHumanReviewLimit} per day.</p>
    </CardContent>
  </Card>;
}
