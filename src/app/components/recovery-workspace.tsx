"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_MESSAGE, DEMO_RECEIVED_AT } from "@/lib/cached-commitment";
import type { RecoveryCaseSnapshot } from "@/lib/recovery";
import { AppHeader } from "@/components/app/app-header";
import { ReplayHeader } from "@/components/collection/replay-header";
import { CustomerMessagePanel } from "@/components/collection/customer-message-panel";
import { ProposalPanel } from "@/components/collection/proposal-panel";
import { PolicyApprovalPanel } from "@/components/collection/policy-approval-panel";
import { RazorpayHandoff } from "@/components/collection/razorpay-handoff";
import { PromiseAndQueueImpact } from "@/components/collection/promise-and-queue-impact";
import { AuditTimeline } from "@/components/collection/audit-timeline";
import { EvidenceBadge } from "@/components/app/evidence-badge";
import type { Replay } from "@/components/collection/types";

export type { Replay } from "@/components/collection/types";

export function RecoveryWorkspace({ initialCase, initialReplay }: { initialCase: RecoveryCaseSnapshot; initialReplay: Replay }) {
  const [recoveryCase, setRecoveryCase] = useState(initialCase);
  const [replay, setReplay] = useState<Replay | null>(initialReplay);
  const [message, setMessage] = useState(DEMO_MESSAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordedFallbackVisible, setRecordedFallbackVisible] = useState(false);

  const refresh = useCallback(async () => {
    const [caseResponse, replayResponse] = await Promise.all([fetch(`/api/recovery-cases/${initialCase.id}`, { cache: "no-store" }), fetch(`/api/recovery-cases/${initialCase.id}/replay`, { cache: "no-store" })]);
    if (caseResponse.ok) setRecoveryCase(((await caseResponse.json()) as { recoveryCase: RecoveryCaseSnapshot }).recoveryCase);
    if (replayResponse.ok) setReplay(((await replayResponse.json()) as { replay: Replay }).replay);
  }, [initialCase.id]);

  useEffect(() => {
    if (!recoveryCase.razorpayPaymentLinkId || recoveryCase.status === "RECOVERED") return;
    const timer = window.setInterval(() => void refresh(), 2_500);
    return () => window.clearInterval(timer);
  }, [recoveryCase.razorpayPaymentLinkId, recoveryCase.status, refresh]);

  const latestProposal = replay?.proposals.at(-1) ?? null;
  const latestPolicy = latestProposal ? replay?.policies.findLast((item) => item.proposalId === latestProposal.id) : null;
  const approved = Boolean(latestProposal && replay?.approvedProposalId === latestProposal.id);
  const latestRun = latestProposal?.decisionRunId ? replay?.runs.find((item) => item.id === latestProposal.decisionRunId) ?? null : null;
  const currentMessage = replay?.messages.find((item) => item.id === latestProposal?.customerMessageId)?.body ?? message;
  const privacyLabel = latestProposal?.source === "CACHED_MODEL" ? "NO PROVIDER CALL" : latestRun?.privacyMode === "ZDR" ? "ZDR ROUTE" : latestRun?.privacyMode === "DATA_COLLECTION_DENY" ? "DATA COLLECTION: DENY" : null;

  async function act(label: string, url: string, body?: unknown) {
    setBusy(label); setError(null);
    try {
      const response = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const result = (await response.json()) as { error?: string; failureCode?: string };
      if (!response.ok) throw new Error(result.error ?? result.failureCode ?? "Action failed");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); }
    finally { setBusy(null); }
  }

  async function resetDemo() {
    if (!window.confirm("Reset only INV-001, INV-002, and INV-003 plus their local demo history? Existing Razorpay objects will not be cancelled.")) return;
    await act("reset", "/api/demo/reset"); setMessage(DEMO_MESSAGE); setRecordedFallbackVisible(false);
  }

  return <main className="min-h-screen bg-background text-foreground">
    <AppHeader active="replay" environment="Razorpay Test Mode" environmentKind="test" onReset={() => void resetDemo()} resetting={busy === "reset"} />
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <ReplayHeader recoveryCase={recoveryCase} />
      <div className="grid gap-6 lg:grid-cols-2"><CustomerMessagePanel message={message} onMessageChange={setMessage} busy={busy} error={error} onLive={() => void act("live", `/api/recovery-cases/${recoveryCase.id}/interpret`, { message, receivedAt: DEMO_RECEIVED_AT, mode: "LIVE" })} onCached={() => void act("cache", `/api/recovery-cases/${recoveryCase.id}/interpret`, { message, receivedAt: DEMO_RECEIVED_AT, mode: "CACHED_REPLAY" })} /><ProposalPanel proposal={latestProposal} currentMessage={currentMessage} privacyLabel={privacyLabel} /></div>
      <PolicyApprovalPanel policy={latestPolicy} hasProposal={Boolean(latestProposal)} approved={approved} busy={busy} onApprove={() => latestProposal && void act("approve", `/api/recovery-proposals/${latestProposal.id}/approval`, { decision: "APPROVED", reviewer: "Finance operator", note: "Approve ₹40,000 partial collection; invoice verification remains routed for review." })} />
      <RazorpayHandoff recoveryCase={recoveryCase} approved={approved} busy={busy} fallbackVisible={recordedFallbackVisible} onCreateLink={() => void act("link", `/api/recovery-cases/${recoveryCase.id}/payment-link`)} onToggleFallback={() => setRecordedFallbackVisible((value) => !value)} />
      <PromiseAndQueueImpact recoveryCase={recoveryCase} replay={replay} />
      <AuditTimeline replay={replay} />
      <footer id="evidence-boundary" className="grid gap-3 border-t pt-6 text-xs text-muted-foreground sm:grid-cols-[auto_1fr_auto] sm:items-start"><EvidenceBadge kind="test">Evidence boundary</EvidenceBadge><p className="leading-5">Razorpay Test Mode demonstrates integration behavior only after a signed webhook. Model decisions are measured; policy is deterministic; cached interpretation is replayed; the recorded fallback is simulated; the Recovery Frontier remains synthetic and unchanged.</p><Link href="/#evidence" className="font-medium text-primary hover:underline">Open Evidence Lab →</Link></footer>
    </div>
  </main>;
}
