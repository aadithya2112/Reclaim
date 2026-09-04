"use client";

import { ArrowRight } from "lucide-react";
import type { RecoveryDashboardData, RecoveryQueueCase } from "@/lib/recovery-dashboard-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { formatCompactMoney } from "@/components/app/money-value";
import { cn } from "@/lib/utils";

export type QueueName = "actNow" | "protected" | "deferred";
export const actionLabel = (action: string) => action.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");

export function RecoveryQueue({ data, queue, onQueueChange, selected, onSelect }: { data: RecoveryDashboardData; queue: QueueName; onQueueChange: (queue: QueueName) => void; selected?: RecoveryQueueCase; onSelect: (item: RecoveryQueueCase) => void }) {
  const items = data.queues[queue];
  return <Card id="queue" className="shadow-none">
    <CardHeader className="border-b"><CardTitle>Today&apos;s recovery queue</CardTitle><CardDescription>Bounded actions selected from {data.portfolio.cases} open synthetic cases.</CardDescription></CardHeader>
    <Tabs value={queue} onValueChange={(value) => onQueueChange(value as QueueName)}><div className="px-4 pt-4"><TabsList className="max-w-full overflow-x-auto"><TabsTrigger value="actNow">Act now <span className="text-muted-foreground">{data.queues.actNow.length}</span></TabsTrigger><TabsTrigger value="protected">Wait / protected <span className="text-muted-foreground">{data.queues.protected.length}</span></TabsTrigger><TabsTrigger value="deferred">Deferred <span className="text-muted-foreground">{data.queues.deferred.length}</span></TabsTrigger></TabsList></div></Tabs>
    {items.length ? <Table className="hidden md:table"><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Overdue</TableHead><TableHead>Executed action</TableHead><TableHead>Policy / priority</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader><TableBody>
      {items.map((item) => <TableRow key={item.id} data-state={selected?.id === item.id ? "selected" : undefined} className="cursor-pointer focus-within:bg-muted" onClick={() => onSelect(item)}><TableCell><button type="button" className="font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelect(item)} aria-label={`Inspect ${item.invoiceId}`}>{item.invoiceId}<span className="block text-[10px] font-normal text-muted-foreground">{item.riskSegment.toLowerCase()} risk</span></button></TableCell><TableCell className="text-muted-foreground">{item.daysOverdue} days</TableCell><TableCell><Badge variant="secondary">{actionLabel(item.executedAction)}</Badge></TableCell><TableCell className="max-w-48 truncate text-xs text-muted-foreground">{item.policyRule ?? (item.priorityScore !== undefined ? `Priority ${Math.round(item.priorityScore)}` : "Policy protected")}</TableCell><TableCell className="text-right font-medium tabular-nums">{formatCompactMoney(item.outstandingPaise)}</TableCell><TableCell><ArrowRight className="size-4 text-muted-foreground" /></TableCell></TableRow>)}
    </TableBody></Table> : <EmptyState title="No cases in this queue" description="Try another queue or increase the selected capacity." />}
    {items.length ? <div className="divide-y md:hidden">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item)} className={cn("grid w-full grid-cols-[1fr_auto] gap-2 p-4 text-left transition-colors", selected?.id === item.id ? "bg-muted" : "hover:bg-muted/50")}><span><strong className="text-sm">{item.invoiceId}</strong><small className="mt-1 block text-xs text-muted-foreground">{item.daysOverdue} days overdue · {actionLabel(item.executedAction)}</small></span><span className="text-sm font-medium tabular-nums">{formatCompactMoney(item.outstandingPaise)}</span></button>)}</div> : null}
  </Card>;
}
