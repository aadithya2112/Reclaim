import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EvidenceKind = "synthetic" | "simulated" | "measured" | "test" | "verified" | "untrusted";

const styles: Record<EvidenceKind, string> = {
  synthetic: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
  simulated: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200",
  measured: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200",
  test: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-200",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
  untrusted: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200",
};

export function EvidenceBadge({ kind, children, className }: { kind: EvidenceKind; children: React.ReactNode; className?: string }) {
  return <Badge variant="outline" className={cn("gap-1.5 font-normal", styles[kind], className)}><span className="size-1.5 rounded-full bg-current opacity-70" />{children}</Badge>;
}
