import { NextRequest, NextResponse } from "next/server";
import { cachedRecoveryDashboard, DASHBOARD_SCENARIOS } from "@/lib/recovery-dashboard";
import type { ScenarioName } from "@/simulation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = value === null ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Expected an integer from ${minimum} to ${maximum}`);
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const rawScenario = request.nextUrl.searchParams.get("scenario") ?? "standard";
    if (!DASHBOARD_SCENARIOS.includes(rawScenario as ScenarioName)) throw new Error("Unknown scenario");
    const data = cachedRecoveryDashboard({
      scenario: rawScenario as ScenarioName,
      dailyContactLimit: boundedInteger(request.nextUrl.searchParams.get("contacts"), 20, 0, 40),
      dailyHumanReviewLimit: boundedInteger(request.nextUrl.searchParams.get("reviews"), 4, 0, 10),
    });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Recovery Frontier request" }, { status: 400 });
  }
}
