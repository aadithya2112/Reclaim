import { mkdir, writeFile } from "node:fs/promises";
import {
  commitmentCorpus,
  COMMITMENT_CORPUS_VERSION,
} from "@/evaluation/commitment-corpus";
import {
  baselineEvaluation,
  classifyCommitmentOutput,
  commitmentEvaluationContext,
  freezeEvaluatedOutcome,
  preflightBlockedOutcome,
  providerFailureOutcome,
  scoreCommitmentOutcomes,
  type EvaluationCaseOutcome,
} from "@/evaluation/commitment-evaluation";
import {
  COMMITMENT_PROMPT_VERSION,
  COMMITMENT_SCHEMA_VERSION,
} from "@/lib/commitment-interpreter";
import {
  interpretWithOpenRouter,
  OPENROUTER_MODEL,
  OPENROUTER_PROVIDER_POLICY_VERSION,
  OpenRouterError,
} from "@/lib/openrouter";

const live = process.argv.includes("--live");
const baseline = baselineEvaluation();
if (!live) {
  console.log(JSON.stringify({
    evidence: "DETERMINISTIC BASELINE ON SYNTHETIC MANUALLY REVIEWED CORPUS",
    corpusVersion: COMMITMENT_CORPUS_VERSION,
    baseline,
  }, null, 2));
  process.exit(0);
}

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required for --live evaluation");
}

const versions = {
  prompt: COMMITMENT_PROMPT_VERSION,
  schema: COMMITMENT_SCHEMA_VERSION,
  provider: OPENROUTER_PROVIDER_POLICY_VERSION,
  model: OPENROUTER_MODEL,
};
const frozen = [];
const outcomes = new Map<string, EvaluationCaseOutcome>();

for (const testCase of commitmentCorpus) {
  let evaluated: EvaluationCaseOutcome;
  if (testCase.gold.injection) {
    evaluated = preflightBlockedOutcome(testCase);
  } else {
    try {
      const result = await interpretWithOpenRouter(commitmentEvaluationContext(testCase));
      evaluated = classifyCommitmentOutput(testCase, result.output, {
        provider: result.provider,
        privacyMode: result.privacyMode,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      evaluated = error instanceof OpenRouterError
        ? providerFailureOutcome(testCase, error.code, error.status ?? null)
        : providerFailureOutcome(testCase, "UNKNOWN_PROVIDER_FAILURE");
    }
  }
  outcomes.set(testCase.id, evaluated);
  frozen.push(freezeEvaluatedOutcome(testCase, evaluated, versions));
}

const manifest = {
  evidence: "MEASURED MODEL DECISIONS ON SYNTHETIC MANUALLY REVIEWED CORPUS",
  resultFormatVersion: "commitment-evaluation-v2",
  generatedAt: new Date().toISOString(),
  corpusVersion: COMMITMENT_CORPUS_VERSION,
  versions,
  metricDenominator: "Model quality rates use the 11 provider-eligible cases; the intentional injection preflight block is reported separately.",
  baseline,
  model: scoreCommitmentOutcomes(outcomes),
  frozen,
};

await mkdir("evaluation-results", { recursive: true });
const artifactName = `commitment-${COMMITMENT_CORPUS_VERSION}-${COMMITMENT_PROMPT_VERSION}-${manifest.generatedAt.replaceAll(":", "-")}.json`;
await writeFile(`evaluation-results/${artifactName}`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ artifact: `evaluation-results/${artifactName}`, ...manifest }, null, 2));
