import type { RecoveryDashboardControls } from "@/lib/recovery-dashboard-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const scenarioLabels: Record<RecoveryDashboardControls["scenario"], string> = { standard: "Standard", conservative: "Conservative", adversarial: "Adversarial", "relationship-sensitive": "Relationship-sensitive" };

export function PortfolioControls({ controls, onChange }: { controls: RecoveryDashboardControls; onChange: (next: RecoveryDashboardControls) => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="Portfolio controls">
    <label className="grid gap-1 text-[11px] text-muted-foreground"><span>Scenario</span><Select value={controls.scenario} onValueChange={(value) => onChange({ ...controls, scenario: value as RecoveryDashboardControls["scenario"] })}><SelectTrigger className="w-44 bg-background" aria-label="Scenario"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(scenarioLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
    <label className="grid gap-1 text-[11px] text-muted-foreground"><span>Daily contacts</span><Select value={String(controls.dailyContactLimit)} onValueChange={(value) => onChange({ ...controls, dailyContactLimit: Number(value) })}><SelectTrigger className="w-32 bg-background" aria-label="Daily contacts"><SelectValue /></SelectTrigger><SelectContent>{[5,10,20,30,40].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label>
    <label className="grid gap-1 text-[11px] text-muted-foreground"><span>Daily reviews</span><Select value={String(controls.dailyHumanReviewLimit)} onValueChange={(value) => onChange({ ...controls, dailyHumanReviewLimit: Number(value) })}><SelectTrigger className="w-32 bg-background" aria-label="Daily reviews"><SelectValue /></SelectTrigger><SelectContent>{[0,2,4,6,8,10].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label>
  </div>;
}
