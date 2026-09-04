import type { RecoveryCaseSnapshot } from "@/lib/recovery";
import { EvidenceBadge } from "@/components/app/evidence-badge";
import { formatMoney } from "@/components/app/money-value";

export function ReplayHeader({ recoveryCase }: { recoveryCase: RecoveryCaseSnapshot }) {
  const outstanding = recoveryCase.amountDue - recoveryCase.amountRecovered;
  const progress = Math.round((recoveryCase.amountRecovered / recoveryCase.amountDue) * 100);
  return <section className="grid gap-6 border-b pb-8 lg:grid-cols-[1fr_360px] lg:items-end">
    <div><p className="text-xs font-medium text-primary">Operational decision replay · {recoveryCase.invoiceNumber}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Interpret, approve, verify.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">AI extracts the commitment. Deterministic policy bounds it. A human authorizes it. Only a signed Razorpay webhook changes the ledger.</p></div>
    <div><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Authoritative outstanding</span><EvidenceBadge kind={recoveryCase.amountRecovered > 0 ? "verified" : "test"}>{recoveryCase.amountRecovered > 0 ? "Verified progress" : "Razorpay Test Mode"}</EvidenceBadge></div><p className="mt-2 text-4xl font-semibold tracking-[-0.05em] tabular-nums">{formatMoney(outstanding)}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-[11px] text-muted-foreground">{formatMoney(recoveryCase.amountRecovered)} verified · {progress}% of invoice</p></div>
  </section>;
}
