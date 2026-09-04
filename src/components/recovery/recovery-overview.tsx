"use client";

import { useEffect, useState } from "react";
import type { RecoveryDashboardControls, RecoveryDashboardData } from "@/lib/recovery-dashboard-types";
import { AppHeader } from "@/components/app/app-header";
import { PageHeading } from "@/components/app/page-heading";
import { ErrorState } from "@/components/app/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PortfolioControls } from "@/components/recovery/portfolio-controls";
import { PortfolioMetrics } from "@/components/recovery/portfolio-metrics";
import { RecoveryFrontier, type ComparedStrategy } from "@/components/recovery/recovery-frontier";
import { StrategySummary } from "@/components/recovery/strategy-summary";
import { RecoveryQueue, type QueueName } from "@/components/recovery/recovery-queue";
import { DecisionInspector } from "@/components/recovery/decision-inspector";
import { EvidenceBoundary } from "@/components/recovery/evidence-boundary";
import { cn } from "@/lib/utils";

export function RecoveryOverview() {
  const [controls, setControls] = useState<RecoveryDashboardControls>({ scenario: "standard", dailyContactLimit: 20, dailyHumanReviewLimit: 4 });
  const [data, setData] = useState<RecoveryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueName>("actNow");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ComparedStrategy>("recoup-hybrid");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams({ scenario: controls.scenario, contacts: String(controls.dailyContactLimit), reviews: String(controls.dailyHumanReviewLimit) });
        const response = await fetch(`/api/recovery-frontier?${params}`, { signal: controller.signal });
        const body = await response.json() as { data?: RecoveryDashboardData; error?: string };
        if (!response.ok || !body.data) throw new Error(body.error ?? "Recovery Frontier could not be generated");
        setData(body.data);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Recovery Frontier could not be generated");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [controls, retryNonce]);

  const queueItems = data?.queues[queue] ?? [];
  const selectedCase = queueItems.find((item) => item.id === selectedCaseId) ?? queueItems[0];

  return <main className="min-h-screen bg-background text-foreground">
    <AppHeader active="command" environment="Synthetic development benchmark" environmentKind="synthetic" />
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeading eyebrow={`Recovery portfolio · ${data?.portfolio.cases ?? 96} synthetic cases`} title="Recovery overview" description="Allocate today’s constrained capacity and inspect why every bounded action was chosen." controls={<PortfolioControls controls={controls} onChange={setControls} />} />
      {error && !data ? <div className="mt-8"><ErrorState title="Benchmark unavailable" description={error} onRetry={() => setRetryNonce((value) => value + 1)} /></div> : null}
      {!data ? <div className="mt-8 space-y-6" aria-label="Generating paired benchmark"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((key) => <Skeleton key={key} className="h-24" />)}</div><Skeleton className="h-[380px]" /><Skeleton className="h-72" /></div> : <div className={cn("relative", loading && "refresh-veil")}>
        <PortfolioMetrics data={data} />
        {error ? <div className="mt-4"><ErrorState title="Refresh failed" description={`${error}. Showing the last successful benchmark.`} onRetry={() => setRetryNonce((value) => value + 1)} /></div> : null}
        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6"><RecoveryFrontier data={data} selectedStrategy={selectedStrategy} onSelectStrategy={setSelectedStrategy} /><StrategySummary data={data} selectedStrategy={selectedStrategy} /><RecoveryQueue data={data} queue={queue} onQueueChange={(value) => { setQueue(value); setSelectedCaseId(null); }} selected={selectedCase} onSelect={(item) => { setSelectedCaseId(item.id); setInspectorOpen(true); }} /></div>
          <aside className="hidden xl:block"><DecisionInspector item={selectedCase} /></aside>
        </div>
        <EvidenceBoundary data={data} />
      </div>}
    </div>
    <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}><SheetContent side="right" className="w-[min(92vw,420px)] overflow-y-auto xl:hidden"><SheetHeader className="sr-only"><SheetTitle>Decision inspector</SheetTitle><SheetDescription>Selected recovery case details</SheetDescription></SheetHeader><DecisionInspector item={selectedCase} embedded /></SheetContent></Sheet>
  </main>;
}
