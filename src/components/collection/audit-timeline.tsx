import type { Replay } from "@/components/collection/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EvidenceBadge } from "@/components/app/evidence-badge";

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function AuditTimeline({ replay }: { replay: Replay | null }) {
  return <section><Collapsible><CollapsibleTrigger className="flex w-full items-end justify-between border-b pb-3 text-left"><div><p className="text-xs font-medium text-primary">Full provenance</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Append-only decision timeline</h2></div><span className="text-xs text-muted-foreground">{replay?.audit.length ?? 0} events · expand</span></CollapsibleTrigger><CollapsibleContent>{replay?.audit.length ? <div className="mt-5 space-y-0">{replay.audit.map((event) => <article key={event.id} className="grid gap-2 border-l py-4 pl-5 sm:grid-cols-[120px_1fr]"><time className="text-[10px] text-muted-foreground">{dateTime.format(new Date(event.createdAt))}</time><div><EvidenceBadge kind={event.evidenceLabel.includes("VERIFIED") ? "verified" : "measured"}>{event.evidenceLabel}</EvidenceBadge><h3 className="mt-2 text-sm font-medium">{event.eventType.replaceAll("_", " ")}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</p><code className="mt-2 block break-all text-[10px] text-muted-foreground">{event.actor} · {event.payloadHash}</code></div></article>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">No operational decisions have been recorded yet.</p>}</CollapsibleContent></Collapsible></section>;
}
