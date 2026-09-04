"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_MESSAGE, DEMO_RECEIVED_AT } from "@/lib/cached-commitment";
import type { CommitmentProposal } from "@/lib/commitment-interpreter";
import { RECORDED_PAYMENT_FALLBACK } from "@/lib/recorded-demo";
import type { RecoveryCaseSnapshot } from "@/lib/recovery";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const formatMoney = (paise: number) => money.format(paise / 100);

export type Replay = {
  approvedProposalId: string | null;
  messages: Array<{ id: string; body: string; receivedAt: string }>;
  runs: Array<{ id: string; status: string; modelId: string; providerName: string | null; privacyMode: string | null; failureCode: string | null; canonicalInputHash: string; promptVersion: string; schemaVersion: string }>;
  proposals: Array<{ id: string; customerMessageId: string; decisionRunId: string | null; revision: number; source: string; proposalHash: string; proposal: CommitmentProposal }>;
  policies: Array<{ proposalId: string; outcome: string; reasons: string[] }>;
  approvals: Array<{ proposalId: string; decision: string; reviewer: string; overrideProposalId: string | null }>;
  promises: Array<{ id: string; proposalId: string; promisedDate: string; amountPaise: number | null; status: string; activationRazorpayEventId: string | null }>;
  audit: Array<{ id: string; eventType: string; detail: string; actor: string; evidenceLabel: string; payloadHash: string; createdAt: string }>;
  queue: Array<{ id: string; invoiceNumber: string; customerName: string; outstandingPaise: number; queueStatus: string; queuePriority: number }>;
};

function Evidence({ proposal, message }: { proposal: CommitmentProposal; message: string }) {
  return <div className="evidence-spans">{proposal.evidence.map((item, index) => (
    <div key={`${item.field}-${index}`}><span>{item.field.replaceAll("_", " ")}</span><q>{message.slice(item.start, item.end)}</q><code>{item.start}:{item.end}</code></div>
  ))}</div>;
}

export function RecoveryWorkspace({ initialCase, initialReplay }: { initialCase: RecoveryCaseSnapshot; initialReplay: Replay }) {
  const [recoveryCase, setRecoveryCase] = useState(initialCase);
  const [replay, setReplay] = useState<Replay | null>(initialReplay);
  const [message, setMessage] = useState(DEMO_MESSAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordedFallbackVisible, setRecordedFallbackVisible] = useState(false);

  const refresh = useCallback(async () => {
    const [caseResponse, replayResponse] = await Promise.all([
      fetch(`/api/recovery-cases/${initialCase.id}`, { cache: "no-store" }),
      fetch(`/api/recovery-cases/${initialCase.id}/replay`, { cache: "no-store" }),
    ]);
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
  const outstanding = recoveryCase.amountDue - recoveryCase.amountRecovered;
  const progress = Math.round((recoveryCase.amountRecovered / recoveryCase.amountDue) * 100);
  const promise = replay?.promises.findLast((item) => item.status !== "CANCELLED") ?? null;
  const latestRun = latestProposal?.decisionRunId
    ? replay?.runs.find((item) => item.id === latestProposal.decisionRunId) ?? null
    : null;

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
    await act("reset", "/api/demo/reset");
    setMessage(DEMO_MESSAGE);
    setRecordedFallbackVisible(false);
  }

  const modelLabel = latestProposal?.source === "CACHED_MODEL" ? "CACHED MODEL REPLAY" : "LIVE MODEL";
  const currentMessage = replay?.messages.find((item) => item.id === latestProposal?.customerMessageId)?.body ?? message;
  const privacyLabel = latestProposal?.source === "CACHED_MODEL"
    ? "NO PROVIDER CALL"
    : latestRun?.privacyMode === "ZDR"
      ? "ZDR ROUTE"
      : latestRun?.privacyMode === "DATA_COLLECTION_DENY"
        ? "DATA COLLECTION: DENY"
        : null;

  return (
    <main className="decision-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">R</span><span>recoup</span></a>
        <nav className="collection-navigation"><Link href="/">Command Center</Link><a href="#evidence-boundary">Evidence Lab</a><button className="nav-reset" type="button" disabled={Boolean(busy)} onClick={() => void resetDemo()}>{busy === "reset" ? "Resetting…" : "Reset demo"}</button><span className="environment"><span className="environment-dot" /> Razorpay Test Mode</span></nav>
      </header>

      <nav className="judge-journey" aria-label="Three-minute judge journey">
        <Link href="/"><span>01</span><strong>Recovery Frontier</strong><small>Paired synthetic</small></Link>
        <a className="is-current" href="#top"><span>02</span><strong>Decision Replay</strong><small>Measured + bounded</small></a>
        <a href="#razorpay-proof"><span>03</span><strong>Razorpay proof</strong><small>Test Mode / fallback</small></a>
        <a href="#evidence-boundary"><span>04</span><strong>Evidence Lab</strong><small>Limits + provenance</small></a>
      </nav>

      <section className="decision-hero" id="top">
        <div><p className="eyebrow">Operational Decision Replay · {recoveryCase.invoiceNumber}</p><h1>Interpret. Approve.<br/><em>Verify the money.</em></h1><p>AI reads the commitment. Policy bounds it. A human authorizes it. Only Razorpay’s signed webhook changes the ledger.</p></div>
        <div className="hero-balance"><span>Authoritative outstanding</span><strong>{formatMoney(outstanding)}</strong><div><i style={{ width: `${progress}%` }} /><span>{formatMoney(recoveryCase.amountRecovered)} verified</span></div></div>
      </section>

      <section className="decision-grid">
        <article className="decision-card message-card">
          <div className="card-number">01</div><p className="eyebrow">Untrusted input</p><h2>Customer response</h2>
          <textarea aria-label="Customer response" value={message} onChange={(event) => setMessage(event.target.value)} />
          <p className="input-meta">Received 03 Sep 2026 · 10:00 IST · English / Hinglish</p>
          <div className="button-row">
            <button disabled={Boolean(busy)} onClick={() => void act("live", `/api/recovery-cases/${recoveryCase.id}/interpret`, { message, receivedAt: DEMO_RECEIVED_AT, mode: "LIVE" })}>{busy === "live" ? "Interpreting…" : "Run live AI"}</button>
            <button className="secondary-button" disabled={Boolean(busy)} onClick={() => void act("cache", `/api/recovery-cases/${recoveryCase.id}/interpret`, { message, receivedAt: DEMO_RECEIVED_AT, mode: "CACHED_REPLAY" })}>Use cached replay</button>
          </div>
          {error ? <p className="error-note" role="alert">{error}</p> : null}
        </article>

        <article className="decision-card model-card">
          <div className="card-number">02</div><div className="card-title-row"><div><p className="eyebrow">Grounded extraction</p><h2>AI proposal</h2></div>{latestProposal ? <div className="provenance-stack"><span className={`provenance ${modelLabel.startsWith("CACHED") ? "provenance--cache" : ""}`}>{modelLabel}</span>{privacyLabel ? <span className="provenance provenance--privacy">{privacyLabel}</span> : null}</div> : null}</div>
          {latestProposal ? <>
            <div className="proposal-primary"><span>{latestProposal.proposal.intent.replaceAll("_", " ")}</span><strong>{latestProposal.proposal.pay_now_paise ? formatMoney(latestProposal.proposal.pay_now_paise) : "No amount"}</strong><p>now · remainder on {latestProposal.proposal.promised_date ?? "—"}</p></div>
            <div className="signal-row"><span>Invoice verification</span><strong>{latestProposal.proposal.invoice_verification_requested ? "Requested" : "No signal"}</strong><span>Confidence</span><strong>{Math.round(latestProposal.proposal.confidence * 100)}%</strong></div>
            <Evidence proposal={latestProposal.proposal} message={currentMessage} />
            <p className="hash-line">output {latestProposal.proposalHash.slice(0, 14)}… · revision {latestProposal.revision}</p>
          </> : <p className="empty-copy">Run the interpreter to freeze a validated proposal and its exact evidence spans.</p>}
        </article>

        <article className="decision-card policy-card">
          <div className="card-number">03</div><p className="eyebrow">Deterministic authority</p><h2>Policy & approval</h2>
          {latestPolicy ? <><div className={`policy-verdict policy-verdict--${latestPolicy.outcome.toLowerCase()}`}><span>{latestPolicy.outcome.replaceAll("_", " ")}</span><strong>{latestPolicy.outcome === "APPROVAL_REQUIRED" ? "Human judgment required" : latestPolicy.outcome}</strong></div><ul className="reason-list">{latestPolicy.reasons.map((reason) => <li key={reason}>{reason.replaceAll("_", " ")}</li>)}</ul>
            {!approved && latestProposal && latestPolicy.outcome !== "BLOCKED" ? <button disabled={Boolean(busy)} onClick={() => void act("approve", `/api/recovery-proposals/${latestProposal.id}/approval`, { decision: "APPROVED", reviewer: "Finance operator", note: "Approve ₹40,000 partial collection; invoice verification remains routed for review." })}>{busy === "approve" ? "Recording…" : "Approve bounded action"}</button> : approved ? <div className="approved-stamp">✓ Human approved · model output preserved</div> : <div className="error-note">Policy block · no handoff allowed</div>}
          </> : <p className="empty-copy">Policy runs after local schema and cross-field validation. It cannot be bypassed by model text.</p>}
        </article>
      </section>

      <section className="handoff-band" id="razorpay-proof">
        <div><p className="eyebrow">04 · Razorpay handoff</p><h2>{recoveryCase.status === "RECOVERED" ? "Collection verified and complete" : recoveryCase.amountRecovered > 0 ? "Partial payment verified; remainder protected" : recoveryCase.razorpayPaymentLinkId ? "Checkout ready; webhook pending" : approved ? "Approved for Test Mode collection" : "Locked until approval"}</h2><p>A browser return never records payment. Signed raw-body webhooks are the only financial truth.</p></div>
        <div className="handoff-actions">
          {recoveryCase.status === "RECOVERED" ? <div className="approved-stamp">✓ Verified webhook closed the balance</div> : !recoveryCase.razorpayPaymentLinkId ? <button disabled={!approved || Boolean(busy)} onClick={() => void act("link", `/api/recovery-cases/${recoveryCase.id}/payment-link`)}>{busy === "link" ? "Creating…" : "Create approved Payment Link"}</button> : <a className="primary-action" href={recoveryCase.razorpayPaymentLinkUrl ?? "#"} target="_blank" rel="noreferrer">Open Razorpay Checkout ↗</a>}
          {approved && recoveryCase.amountRecovered === 0 ? <button className="recorded-fallback-button" type="button" onClick={() => setRecordedFallbackVisible((visible) => !visible)}>{recordedFallbackVisible ? "Hide recorded fallback" : "Preview recorded fallback"}</button> : null}
          <code>{recoveryCase.razorpayPaymentLinkId ?? "No external payment object yet"}</code>
        </div>
      </section>

      {recordedFallbackVisible ? <section className="recorded-fallback" aria-label="Recorded payment fallback">
        <div><span className="provenance provenance--recorded">{RECORDED_PAYMENT_FALLBACK.evidenceLabel}</span><p className="eyebrow">Rehearsal continuity only</p><h2>Illustrated ₹40,000 payment outcome</h2><p>If hosted Checkout or the public webhook is unavailable during judging, this deterministic recording illustrates the expected transition. It does not invoke Razorpay, verify a signature, write the ledger, or change a recovery metric.</p></div>
        <div className="recorded-transition"><span>{formatMoney(RECORDED_PAYMENT_FALLBACK.input.startingOutstandingPaise)}<small>actual starting balance</small></span><b>→</b><span>{formatMoney(RECORDED_PAYMENT_FALLBACK.illustratedOutcome.outstandingPaise)}<small>illustrated remainder</small></span><div><strong>INV-003</strong><em>WAIT PROTECTED</em></div><div><strong>{RECORDED_PAYMENT_FALLBACK.illustratedOutcome.promotedInvoiceNumber}</strong><em>ACT NOW</em></div></div>
      </section> : null}

      <section className="after-grid">
        <article><p className="eyebrow">05 · Promise protection</p><h2>{promise?.status === "ACTIVE" ? `${formatMoney(promise.amountPaise ?? 0)} protected` : recoveryCase.status === "RECOVERED" ? "No remainder outstanding" : "Waiting for verified ₹40,000"}</h2><p>{promise?.status === "ACTIVE" ? `Authoritative application arithmetic activated the remainder through ${promise.promisedDate}.` : recoveryCase.status === "RECOVERED" ? "Verified cumulative payment already closed this case; no new promise is inferred." : "The model’s remainder is pending; it is not authoritative until the exact verified partial payment arrives."}</p><span className="provenance">{promise?.status === "ACTIVE" || recoveryCase.status === "RECOVERED" ? "VERIFIED TEST WEBHOOK" : "NO PAYMENT CLAIM"}</span></article>
        <article><p className="eyebrow">06 · Operational queue</p><h2>Freed capacity moves</h2><div className="queue-list">{replay?.queue.map((item) => <div key={item.id} className={item.id === recoveryCase.id ? "queue-current" : ""}><span>{item.invoiceNumber}<small>{item.customerName}</small></span><strong>{item.queueStatus.replaceAll("_", " ")}</strong></div>)}</div><p className="boundary-note">Operational Test Mode queue · separate from the synthetic Recovery Frontier.</p></article>
      </section>

      <section className="timeline-section"><div className="section-heading"><div><p className="eyebrow">Full provenance</p><h2>Append-only decision timeline</h2></div><span>{replay?.audit.length ?? 0} events</span></div><div className="replay-timeline">{replay?.audit.length ? replay.audit.map((event) => <div key={event.id}><time>{dateTime.format(new Date(event.createdAt))}</time><span className="timeline-dot"/><div><span className="provenance">{event.evidenceLabel}</span><h3>{event.eventType.replaceAll("_", " ")}</h3><p>{event.detail}</p><code>{event.actor} · {event.payloadHash.slice(0, 14)}…</code></div></div>) : <p className="empty-copy">No operational decisions have been recorded yet.</p>}</div></section>
      <footer className="evidence-footer" id="evidence-boundary"><strong>Evidence boundary</strong><span>Razorpay Test Mode demonstrates integration behavior only after a signed webhook. Model decisions are measured; policy is deterministic; cached interpretation is replayed; the recorded fallback is simulated; the Recovery Frontier remains synthetic and unchanged.</span><Link href="/#evidence">Open Evidence Lab →</Link></footer>
    </main>
  );
}
