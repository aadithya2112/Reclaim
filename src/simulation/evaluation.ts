import { createHash } from "node:crypto";
import { EVALUATION_SET_MANIFEST } from "./scenarios";
import { stableJson } from "./potential-outcomes";
import { compareStrategies } from "./simulator";
import type { EvaluationSetName, SimulationConfigInput, StrategyComparison, StrategyName } from "./types";

export interface EvaluationAggregate { schemaVersion: "1.0.0"; evaluationSet: Exclude<EvaluationSetName, "custom">; seeds: number[]; constituentComparisonIds: string[]; constituentBankHashes: string[]; scenario: string; strategyOrder: StrategyName[]; comparisons: StrategyComparison[]; perStrategy: Record<string, { recoveryPaiseBySeed: number[]; incrementalVsNativePaiseBySeed: number[]; minPaise: number; medianPaise: number; maxPaise: number; rangePaise: [number, number]; recoveryPerContactBySeed: number[]; contactsBySeed: number[]; reviewsBySeed: number[]; promiseFulfillmentBySeed: number[]; protectionBySeed: number[]; policyBlocksBySeed: number[]; safetyBlocksBySeed: number[]; wins: number; ties: number; losses: number }>; reconciliation: { valid: boolean; invalidComparisonIds: string[] }; sha256: string }
const median = (values: number[]) => { const sorted = [...values].sort((a,b) => a-b); return sorted.length % 2 ? sorted[(sorted.length-1)/2] : (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2; };
export function assertEvaluationSeed(evaluationSet: EvaluationSetName, seed: number, completeSuite = false): void {
  if (evaluationSet === "custom") return;
  const declared = EVALUATION_SET_MANIFEST.sets[evaluationSet];
  if (!declared.includes(seed)) throw new Error(`Seed ${seed} is not a member of the ${evaluationSet} evaluation set; use --evaluation-set custom.`);
  if (completeSuite && declared.length < 1) throw new Error("Named evaluation set has no declared seeds.");
}
export function aggregateComparisons(evaluationSet: Exclude<EvaluationSetName, "custom">, comparisons: StrategyComparison[]): EvaluationAggregate {
  const seeds = EVALUATION_SET_MANIFEST.sets[evaluationSet];
  if (comparisons.length !== seeds.length || comparisons.some((c, i) => c.commonConfig.seed !== seeds[i])) throw new Error("Aggregate must contain every declared seed in manifest order.");
  const names = [...new Set(comparisons.flatMap((comparison) => comparison.results.map((result) => result.config.strategy)))].sort() as StrategyName[];
  const invalidComparisonIds = comparisons.filter((comparison) => !comparison.reconciliation.valid).map((comparison) => comparison.comparisonId);
  const nativeBySeed = comparisons.map((comparison) => comparison.results.find((result) => result.config.strategy === "razorpay-native-reminders")?.metrics.recovery.totalRecoveredPaise);
  if (nativeBySeed.some((value) => value === undefined)) throw new Error("Aggregate requires the Razorpay-native baseline.");
  const perStrategy = Object.fromEntries(names.map((name) => {
    const results = comparisons.map((comparison) => comparison.results.find((result) => result.config.strategy === name)!);
    const recovery = results.map((r) => r.metrics.recovery.totalRecoveredPaise); const incremental = recovery.map((value, i) => value - nativeBySeed[i]!);
    return [name, { recoveryPaiseBySeed: recovery, incrementalVsNativePaiseBySeed: incremental, minPaise: Math.min(...recovery), medianPaise: median(recovery), maxPaise: Math.max(...recovery), rangePaise: [Math.min(...recovery), Math.max(...recovery)] as [number, number], recoveryPerContactBySeed: results.map((r) => r.metrics.efficiency.recoveredPaisePerContact), contactsBySeed: results.map((r) => r.metrics.capacity.contactConsumed), reviewsBySeed: results.map((r) => r.metrics.capacity.humanReviewConsumed), promiseFulfillmentBySeed: results.map((r) => r.metrics.promises.fulfillmentRate), protectionBySeed: results.map((r) => r.metrics.safety.protectedContactsAvoided), policyBlocksBySeed: results.map((r) => r.metrics.safety.policyBlocks), safetyBlocksBySeed: results.map((r) => r.metrics.safety.disputeStops + r.metrics.safety.terminalStops), wins: incremental.filter((v) => v > 0).length, ties: incremental.filter((v) => v === 0).length, losses: incremental.filter((v) => v < 0).length }];
  }));
  const core = { schemaVersion: "1.0.0" as const, evaluationSet, seeds: [...seeds], constituentComparisonIds: comparisons.map((c) => c.comparisonId), constituentBankHashes: comparisons.map((c) => c.potentialOutcomeBankHash), scenario: comparisons[0].commonConfig.scenario, strategyOrder: names, comparisons, perStrategy, reconciliation: { valid: invalidComparisonIds.length === 0, invalidComparisonIds } };
  return { ...core, sha256: createHash("sha256").update(stableJson(core)).digest("hex") };
}
export function runEvaluationSuite(input: Omit<SimulationConfigInput, "seed" | "evaluationSet"> & { evaluationSet: Exclude<EvaluationSetName, "custom"> }, names?: StrategyName[]): EvaluationAggregate {
  const comparisons = EVALUATION_SET_MANIFEST.sets[input.evaluationSet].map((seed) => compareStrategies({ ...input, seed, evaluationSet: input.evaluationSet }, names));
  return aggregateComparisons(input.evaluationSet, comparisons);
}
