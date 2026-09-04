import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EvidenceKind = "synthetic" | "simulated" | "measured" | "test" | "verified" | "untrusted";

const styles: Record<EvidenceKind, string> = {
  synthetic: "border-amber-200 bg-amber-50 text-amber-800",
  simulated: "border-violet-200 bg-violet-50 text-violet-800",
  measured: "border-sky-200 bg-sky-50 text-sky-800",
  test: "border-orange-200 bg-orange-50 text-orange-800",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  untrusted: "border-rose-200 bg-rose-50 text-rose-800",
};

export function EvidenceBadge({ kind, children, className }: { kind: EvidenceKind; children: React.ReactNode; className?: string }) {
  return <Badge variant="outline" className={cn("gap-1.5 font-normal", styles[kind], className)}><span className="size-1.5 rounded-full bg-current opacity-70" />{children}</Badge>;
}
