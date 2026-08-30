import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareStrategies, formatTimeline, runSimulation, STRATEGY_NAMES } from "./simulator";
import { SIMULATOR_VERSION } from "./types";
import { EVALUATION_SET_MANIFEST, SCENARIO_MANIFESTS } from "./scenarios";
import type { EvaluationSetName, SimulationResult, StrategyComparison, StrategyName } from "./types";

const EVALUATION_SEEDS = EVALUATION_SET_MANIFEST.sets;

function options(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "verbose" || key === "compare") { out[key] = true; continue; }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    out[key] = value;
  }
  return out;
}

function integer(value: string | boolean | undefined, name: string, defaultValue: number, minimum: number) {
  const parsed = value === undefined ? defaultValue : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`--${name} must be an integer >= ${minimum}`);
  return parsed;
}

function strategyName(value: string | boolean | undefined): StrategyName {
  if (value === undefined || value === "baseline") return "finance-age-bucket";
  if (typeof value === "string" && STRATEGY_NAMES.includes(value as StrategyName)) return value as StrategyName;
  throw new Error(`--strategy must be one of: ${STRATEGY_NAMES.join(", ")} (legacy alias: baseline)`);
}

const inr = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

async function recreateDirectory(root: string, name: string): Promise<string> {
  const directory = resolve(root, name);
  if (!directory.startsWith(`${root}/`)) throw new Error("Invalid output path");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  return directory;
}

async function writeRun(result: SimulationResult, directory: string): Promise<void> {
  await Promise.all([
    writeFile(`${directory}/config.json`, json({ simulatorVersion: SIMULATOR_VERSION, logicalRunId: result.runId, potentialOutcomeBankHash: result.potentialOutcomeBankHash, ...result.config, provenance: "SYNTHETIC_SIMULATION" })),
    writeFile(`${directory}/portfolio.json`, json(result.initialPortfolio)),
    writeFile(`${directory}/simulation-state.json`, json({ warning: "HIDDEN SYNTHETIC ENVIRONMENT — NEVER PROVIDED TO STRATEGIES", customers: result.hiddenState })),
    writeFile(`${directory}/cases-final.json`, json(result.finalCases)),
    writeFile(`${directory}/audit-events.jsonl`, `${result.auditEvents.map((event) => JSON.stringify(event)).join("\n")}\n`),
    writeFile(`${directory}/synthetic-payments.jsonl`, `${result.payments.map((payment) => JSON.stringify(payment)).join("\n")}${result.payments.length ? "\n" : ""}`),
    writeFile(`${directory}/daily-capacity.json`, json(result.dailyCapacity)),
    writeFile(`${directory}/metrics.json`, json(result.metrics)),
    writeFile(`${directory}/summary.md`, summary(result)),
  ]);
}

function summary(result: SimulationResult) {
  return `# Synthetic recovery benchmark\n\n**Simulation outcomes are synthetic and are not claims about actual Razorpay merchant recovery performance.**\n\n- Logical run: \`${result.runId}\`\n- Strategy: \`${result.config.strategy}\`\n- Seed: ${result.config.seed}\n- Cases / virtual days: ${result.config.caseCount} / ${result.config.days}\n- Daily contact / human-review budgets: ${result.config.capacity.dailyContactLimit} / ${result.config.capacity.dailyHumanReviewLimit}\n- Contact consumed / deferred eligible: ${result.metrics.capacity.contactConsumed} / ${result.metrics.capacity.contactDeferredEligible}\n- Human review consumed / deferred eligible: ${result.metrics.capacity.humanReviewConsumed} / ${result.metrics.capacity.humanReviewDeferredEligible}\n- Protected contacts avoided: ${result.metrics.safety.protectedContactsAvoided}\n- Starting outstanding: ${inr(result.metrics.portfolio.totalStartingOutstandingPaise)}\n- Simulated recovery: ${inr(result.metrics.recovery.totalRecoveredPaise)} (${(result.metrics.recovery.recoveryRate * 100).toFixed(2)}%)\n- Fully / partially recovered: ${result.metrics.recovery.fullyRecoveredCases} / ${result.metrics.recovery.partiallyRecoveredCases}\n- Disputed / escalated: ${result.metrics.recovery.disputedCases} / ${result.metrics.recovery.escalatedCases}\n- Reconciliation valid: ${result.metrics.reconciliation.valid}\n\nReceivables, behavior, reminders, delivery, responses, and payments in this report are synthetic. Razorpay and external communication channels are not called by this harness. The native reminder baseline is a disclosed model of documented Payment Link reminder capability, not evidence of delivery or recovery.\n`;
}

function comparisonMarkdown(comparison: StrategyComparison): string {
  const rows = comparison.results.map((result) => `| ${result.config.strategy} | ${inr(result.metrics.recovery.totalRecoveredPaise)} | ${(result.metrics.recovery.recoveryRate * 100).toFixed(2)}% | ${result.metrics.capacity.contactConsumed} | ${result.metrics.capacity.humanReviewConsumed} | ${result.metrics.capacity.contactDeferredEligible + result.metrics.capacity.humanReviewDeferredEligible} |`).join("\n");
  return [
    "# Synthetic strategy comparison",
    "",
    "**This is not a causal estimate or a claim about real merchant recovery.**",
    "",
    "**Paired synthetic status:** " + comparison.pairedOutcomeStatus + ". All strategies share a frozen portfolio, hidden profiles, and potential-outcome bank.",
    "",
    "- Scenario / version: " + comparison.scenarioManifest.name + " / " + comparison.scenarioManifest.version,
    "- Evaluation set / seed: " + comparison.commonConfig.evaluationSet + " / " + comparison.commonConfig.seed,
    "- Shared bank SHA-256: `" + comparison.potentialOutcomeBankHash + "`",
    "- Reconciliation: " + (comparison.reconciliation.valid ? "valid" : "INVALID"),
    "",
    "| Strategy | Simulated recovery | Recovery rate | Contacts | Human reviews | Deferred eligible |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    rows,
    "",
    "## Evaluation boundary",
    "",
    comparison.limitation,
    "",
    "The Razorpay-native row models a disclosed fixed three-reminder Payment Link schedule on simulation days 0, 3, and 7. Razorpay documents configurable Payment Link reminders, but this schedule, delivery, response, and recovery are simulation assumptions.",
    "",
  ].join("\n");
}

async function main() {
  const args = options(process.argv.slice(2));
  const allowed = new Set(["cases", "days", "seed", "strategy", "scenario", "evaluation-set", "output", "verbose", "case", "compare", "contact-capacity", "review-capacity"]);
  for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`Unknown option --${key}`);
  if (args.scenario !== undefined && (typeof args.scenario !== "string" || !(args.scenario in SCENARIO_MANIFESTS))) throw new Error(`--scenario must be one of: ${Object.keys(SCENARIO_MANIFESTS).join(", ")}`);
  const evaluationSet = (args["evaluation-set"] ?? "development") as EvaluationSetName;
  if (!["development", "held-out", "custom"].includes(evaluationSet)) throw new Error("--evaluation-set must be development, held-out, or custom");
  if (evaluationSet === "custom" && args.seed === undefined) throw new Error("--evaluation-set custom requires --seed");
  const defaultSeed = evaluationSet === "custom" ? 42 : EVALUATION_SEEDS[evaluationSet][0];
  const common = {
    caseCount: integer(args.cases, "cases", 1000, 1),
    days: integer(args.days, "days", 30, 1),
    seed: integer(args.seed, "seed", defaultSeed, Number.MIN_SAFE_INTEGER),
    scenario: (args.scenario ?? "standard") as keyof typeof SCENARIO_MANIFESTS,
    evaluationSet,
    capacity: {
      dailyContactLimit: integer(args["contact-capacity"], "contact-capacity", 100, 0),
      dailyHumanReviewLimit: integer(args["review-capacity"], "review-capacity", 10, 0),
    },
  };
  const root = resolve(String(args.output ?? "simulation-results"));
  await mkdir(root, { recursive: true });

  if (args.compare) {
    if (args.strategy !== undefined) throw new Error("--strategy cannot be combined with --compare; comparison runs all available strategies");
    if (args.case !== undefined || args.verbose) throw new Error("--case and --verbose are available only for a single-strategy run");
    const comparison = compareStrategies(common);
    const directory = await recreateDirectory(root, `comparison-${comparison.comparisonId}`);
    for (const result of comparison.results) {
      const strategyDirectory = `${directory}/${result.config.strategy}`;
      await mkdir(strategyDirectory, { recursive: true });
      await writeRun(result, strategyDirectory);
    }
    await Promise.all([
      writeFile(`${directory}/comparison.json`, json(comparison)),
      writeFile(`${directory}/comparison.md`, comparisonMarkdown(comparison)),
      writeFile(`${directory}/scenario-manifest.json`, json(comparison.scenarioManifest)),
      writeFile(`${directory}/evaluation-set-manifest.json`, json(EVALUATION_SET_MANIFEST)),
      writeFile(`${directory}/potential-outcome-bank.json`, json({ warning: "HIDDEN SYNTHETIC ENVIRONMENT — NEVER PROVIDED TO STRATEGIES", ...comparison.potentialOutcomeBank })),
    ]);
    console.log(`Frozen paired synthetic strategy comparison ${comparison.comparisonId}\nEvidence: paired synthetic outputs; not causal or real-world recovery\nScenario / evaluation set: ${common.scenario} / ${common.evaluationSet}\nBank SHA-256: ${comparison.potentialOutcomeBankHash}\nReconciliation: ${comparison.reconciliation.valid}\nContact / review capacity per day: ${common.capacity.dailyContactLimit} / ${common.capacity.dailyHumanReviewLimit}`);
    for (const result of comparison.results) console.log(`${result.config.strategy}: ${inr(result.metrics.recovery.totalRecoveredPaise)} simulated recovery; ${result.metrics.capacity.contactConsumed} contacts; ${result.metrics.capacity.humanReviewConsumed} reviews`);
    console.log(`Paired potential-outcome bank: frozen and shared\nArtifacts: ${directory}`);
    return;
  }

  const result = runSimulation({ ...common, strategy: strategyName(args.strategy) });
  const directory = await recreateDirectory(root, `run-${result.runId}`);
  await writeRun(result, directory);
  console.log(`Synthetic simulation ${result.runId}\nStrategy: ${result.config.strategy}\nCases generated: ${result.config.caseCount}\nVirtual days: ${result.config.days}\nDaily contact / review capacity: ${result.config.capacity.dailyContactLimit} / ${result.config.capacity.dailyHumanReviewLimit}\nContact consumed / deferred: ${result.metrics.capacity.contactConsumed} / ${result.metrics.capacity.contactDeferredEligible}\nReview consumed / deferred: ${result.metrics.capacity.humanReviewConsumed} / ${result.metrics.capacity.humanReviewDeferredEligible}\nStarting amount: ${inr(result.metrics.portfolio.totalStartingOutstandingPaise)}\nRecovered amount: ${inr(result.metrics.recovery.totalRecoveredPaise)}\nRecovery rate: ${(result.metrics.recovery.recoveryRate * 100).toFixed(2)}%\nFull / partial recoveries: ${result.metrics.recovery.fullyRecoveredCases} / ${result.metrics.recovery.partiallyRecoveredCases}\nProtected contacts avoided: ${result.metrics.safety.protectedContactsAvoided}\nReconciliation valid: ${result.metrics.reconciliation.valid}\nArtifacts: ${directory}`);
  if (args.case) console.log(`\n${formatTimeline(result, String(args.case))}`);
  if (args.verbose) console.log(`\n${formatTimeline(result, result.finalCases[0].id)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
