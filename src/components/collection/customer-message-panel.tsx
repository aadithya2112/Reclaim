import { Bot, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceBadge } from "@/components/app/evidence-badge";

export function CustomerMessagePanel({ message, onMessageChange, busy, error, onLive, onCached }: { message: string; onMessageChange: (value: string) => void; busy: string | null; error: string | null; onLive: () => void; onCached: () => void }) {
  return <Card className="shadow-none"><CardHeader className="border-b"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">01 · Customer message</p><CardTitle className="mt-1">Interpret untrusted input</CardTitle><CardDescription className="mt-1">Received 03 Sep 2026 · 10:00 IST · English / Hinglish</CardDescription></div><EvidenceBadge kind="untrusted">Untrusted input</EvidenceBadge></div></CardHeader><CardContent><Textarea aria-label="Customer response" className="min-h-36 resize-y leading-6" value={message} onChange={(event) => onMessageChange(event.target.value)} /><div className="mt-4 flex flex-wrap gap-2"><Button disabled={Boolean(busy)} onClick={onLive}><Bot />{busy === "live" ? "Interpreting…" : "Run live AI"}</Button><Button variant="outline" disabled={Boolean(busy)} onClick={onCached}><Database />Use cached replay</Button></div>{error ? <p className="mt-3 text-xs text-destructive" role="alert">{error}</p> : null}</CardContent></Card>;
}
