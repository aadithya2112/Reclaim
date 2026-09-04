import { ExternalLink, LockKeyhole } from "lucide-react";
import type { RecoveryCaseSnapshot } from "@/lib/recovery";
import { RECORDED_PAYMENT_FALLBACK } from "@/lib/recorded-demo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceBadge } from "@/components/app/evidence-badge";
import { formatMoney } from "@/components/app/money-value";

export function RazorpayHandoff({ recoveryCase, approved, busy, fallbackVisible, onCreateLink, onToggleFallback }: { recoveryCase: RecoveryCaseSnapshot; approved: boolean; busy: string | null; fallbackVisible: boolean; onCreateLink: () => void; onToggleFallback: () => void }) {
  const heading = recoveryCase.status === "RECOVERED" ? "Collection verified and complete" : recoveryCase.amountRecovered > 0 ? "Partial payment verified; remainder protected" : recoveryCase.razorpayPaymentLinkId ? "Checkout ready; webhook pending" : approved ? "Approved for Test Mode collection" : "Locked until approval";
  return <section id="razorpay-proof">
    <Card className="shadow-none"><CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">04 · Razorpay handoff</p><CardTitle className="mt-1 text-xl">{heading}</CardTitle><CardDescription className="mt-1">A browser return never records payment. Signed raw-body webhooks are the only financial truth.</CardDescription></div><EvidenceBadge kind={recoveryCase.amountRecovered > 0 ? "verified" : "test"}>{recoveryCase.amountRecovered > 0 ? "VERIFIED TEST WEBHOOK" : "RAZORPAY TEST MODE"}</EvidenceBadge></div></CardHeader>
      <CardContent><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex flex-wrap gap-2">
        {recoveryCase.status === "RECOVERED" ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">✓ Verified webhook closed the balance</div> : !recoveryCase.razorpayPaymentLinkId ? <Button disabled={!approved || Boolean(busy)} onClick={onCreateLink}><LockKeyhole />{busy === "link" ? "Creating…" : "Create approved Payment Link"}</Button> : <a className={buttonVariants()} href={recoveryCase.razorpayPaymentLinkUrl ?? "#"} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open Razorpay Checkout</a>}
        {approved && recoveryCase.amountRecovered === 0 ? <Button variant="outline" onClick={onToggleFallback}>{fallbackVisible ? "Hide recorded fallback" : "Preview recorded fallback"}</Button> : null}
      </div><code className="break-all text-[10px] text-muted-foreground">{recoveryCase.razorpayPaymentLinkId ?? "No external payment object yet"}</code></div></CardContent>
    </Card>
    {fallbackVisible ? <div className="surface-enter mt-3 grid gap-5 rounded-xl border border-violet-200 bg-violet-50 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><EvidenceBadge kind="simulated">{RECORDED_PAYMENT_FALLBACK.evidenceLabel}</EvidenceBadge><h3 className="mt-3 text-lg font-semibold">Illustrated ₹40,000 payment outcome</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-violet-900/70">If Checkout or the public webhook is unavailable during judging, this recording illustrates the expected transition. It does not invoke Razorpay, verify a signature, write the ledger, or change a recovery metric.</p></div><div className="flex items-center gap-3 text-sm"><span><strong className="block text-lg">{formatMoney(RECORDED_PAYMENT_FALLBACK.input.startingOutstandingPaise)}</strong><small>actual start</small></span><span aria-hidden="true">→</span><span><strong className="block text-lg">{formatMoney(RECORDED_PAYMENT_FALLBACK.illustratedOutcome.outstandingPaise)}</strong><small>illustrated remainder</small></span></div></div> : null}
  </section>;
}
