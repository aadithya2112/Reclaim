import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export const formatMoney = (paise: number) => money.format(paise / 100);
export const formatCompactMoney = (paise: number) => compact.format(paise / 100);

export function MoneyValue({ paise, compact: isCompact = false, signed = false, className, note }: { paise: number; compact?: boolean; signed?: boolean; className?: string; note?: string }) {
  const value = isCompact ? formatCompactMoney(Math.abs(paise)) : formatMoney(Math.abs(paise));
  return <span className={cn("tabular-nums", paise < 0 ? "text-destructive" : signed && paise > 0 ? "text-primary" : "", className)}>{signed && paise !== 0 ? (paise > 0 ? "+" : "−") : ""}{value}{note ? <small className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">{note}</small> : null}</span>;
}
