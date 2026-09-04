import Link from "next/link";
import { Activity, Clock3, ShieldCheck } from "lucide-react";
import type { RecoveryQueueCase } from "@/lib/recovery-dashboard-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EvidenceBadge } from "@/components/app/evidence-badge";
import { formatMoney } from "@/components/app/money-value";
import { actionLabel } from "@/components/recovery/recovery-queue";

export function DecisionInspector({ item, embedded = false }: { item?: RecoveryQueueCase; embedded?: boolean }) {
  if (!item) return <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Select a case to inspect its decision.</div>;
  const difference = item.nativeBaseline.simulatedDifferencePaise;
  const content = <>
    <CardHeader><div className="flex items-center justify-between"><EvidenceBadge kind="measured">Selected decision</EvidenceBadge><Badge variant="outline">{item.queue.replaceAll("_", " ")}</Badge></div><div className="pt-3"><CardTitle className="text-2xl">{item.invoiceId}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{item.daysOverdue} days overdue · {item.riskSegment.toLowerCase()} risk</p></div></CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-1 text-3xl font-semibold tracking-[-0.04em] tabular-nums">{formatMoney(item.outstandingPaise)}</p>
      <div className="mt-5 rounded-xl bg-primary/8 p-4"><div className="flex items-center gap-2 text-xs font-medium text-primary"><Activity className="size-3.5" />Recommended action</div><p className="mt-3 text-sm font-medium">{actionLabel(item.proposedAction)}</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.reason}</p></div>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border"><div className="bg-background p-3"><dt className="text-[10px] text-muted-foreground">Confidence</dt><dd className="mt-1 text-xs font-medium">{item.confidence === undefined ? "Rules" : `${Math.round(item.confidence * 100)}%`}</dd></div><div className="bg-background p-3"><dt className="text-[10px] text-muted-foreground">Priority</dt><dd className="mt-1 text-xs font-medium">{item.priorityScore === undefined ? "Protected" : Math.round(item.priorityScore)}</dd></div></dl>
      <div className="mt-5 flex gap-2.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-medium">{item.policyRule ?? "Policy checks passed"}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.policyReason}</p></div></div>
      <Collapsible><CollapsibleTrigger className="mt-5 w-full rounded-lg border px-3 py-2 text-left text-xs font-medium hover:bg-muted">Paired attribution and factors</CollapsibleTrigger><CollapsibleContent className="pt-3 text-xs"><div className="grid gap-2 rounded-lg bg-muted p-3"><p className="flex justify-between"><span>Recoup</span><strong>{formatMoney(item.nativeBaseline.recoupRecoveredPaise)} simulated</strong></p><p className="flex justify-between"><span>Native baseline</span><strong>{formatMoney(item.nativeBaseline.nativeRecoveredPaise)} simulated</strong></p><p className="flex justify-between border-t pt-2"><span>Paired difference</span><strong className={difference >= 0 ? "text-primary" : "text-destructive"}>{difference >= 0 ? "+" : ""}{formatMoney(difference)}</strong></p></div><div className="mt-3 divide-y">{item.factors.slice(0,5).map((factor) => <div key={factor.signal} className="flex justify-between gap-3 py-2"><span className="text-muted-foreground">{factor.signal.replaceAll("_", " ")}</span><strong>{String(factor.value)}</strong></div>)}</div></CollapsibleContent></Collapsible>
      <Collapsible><CollapsibleTrigger className="mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium hover:bg-muted">Audit timeline <span>{item.timeline.length}</span></CollapsibleTrigger><CollapsibleContent><ol className="mt-3 space-y-3 border-l pl-4">{item.timeline.map((event,index) => <li key={`${event.day}-${event.type}-${index}`}><p className="text-[10px] text-muted-foreground">Day {event.day}</p><p className="text-xs font-medium">{event.type.replaceAll("_", " ")}</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{event.reason}</p></li>)}</ol></CollapsibleContent></Collapsible>
      <Button className="mt-6 w-full" nativeButton={false} render={<Link href="/collection" />}>Open operational replay <span aria-hidden="true">↗</span></Button>
      <p className="mt-4 flex gap-2 text-[10px] leading-4 text-muted-foreground"><Clock3 className="mt-0.5 size-3 shrink-0" />Measured decision on synthetic receivables. Payment is verified only after a signed Razorpay webhook.</p>
    </CardContent>
  </>;
  return embedded ? <div className="surface-enter">{content}</div> : <Card className="sticky top-24 shadow-none surface-enter">{content}</Card>;
}
