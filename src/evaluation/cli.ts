import { mkdir, writeFile } from "node:fs/promises";
import { commitmentCorpus, COMMITMENT_CORPUS_VERSION } from "@/evaluation/commitment-corpus";
import { baselineEvaluation, freezeEvaluatedOutput, scoreCommitmentOutputs } from "@/evaluation/commitment-evaluation";
import { BUSINESS_TIMEZONE, COMMITMENT_PROMPT_VERSION, COMMITMENT_SCHEMA_VERSION, detectPromptInjection } from "@/lib/commitment-interpreter";
import { interpretWithOpenRouter, OPENROUTER_MODEL, OPENROUTER_PROVIDER_POLICY_VERSION } from "@/lib/openrouter";

const live = process.argv.includes("--live");
const baseline = baselineEvaluation();
if (!live) {
  console.log(JSON.stringify({ evidence: "DETERMINISTIC BASELINE ON SYNTHETIC MANUALLY REVIEWED CORPUS", corpusVersion: COMMITMENT_CORPUS_VERSION, baseline }, null, 2));
  process.exit(0);
}
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for --live evaluation");
const frozen = [];
const outputs = new Map<string, unknown>();
for (const testCase of commitmentCorpus) {
  if (detectPromptInjection(testCase.message)) continue;
  const context = { recoveryCaseId: `eval-${testCase.id}`, invoiceNumber: `EVAL-${testCase.id}`, amountDuePaise: 10_000_000, amountRecoveredPaise: 0, currency: "INR" as const, message: testCase.message, messageReceivedAt: testCase.receivedAt, businessTimezone: BUSINESS_TIMEZONE as typeof BUSINESS_TIMEZONE };
  try {
    const result = await interpretWithOpenRouter(context);
    outputs.set(testCase.id, result.output);
    frozen.push(freezeEvaluatedOutput(testCase, result.output, { prompt: COMMITMENT_PROMPT_VERSION, schema: COMMITMENT_SCHEMA_VERSION, provider: OPENROUTER_PROVIDER_POLICY_VERSION, model: OPENROUTER_MODEL }));
  } catch (error) {
    frozen.push(freezeEvaluatedOutput(testCase, { failure: error instanceof Error ? error.name : "UNKNOWN" }, { prompt: COMMITMENT_PROMPT_VERSION, schema: COMMITMENT_SCHEMA_VERSION, provider: OPENROUTER_PROVIDER_POLICY_VERSION, model: OPENROUTER_MODEL }));
  }
}
const manifest = { evidence: "MEASURED MODEL DECISIONS ON SYNTHETIC MANUALLY REVIEWED CORPUS", generatedAt: new Date().toISOString(), corpusVersion: COMMITMENT_CORPUS_VERSION, versions: { prompt: COMMITMENT_PROMPT_VERSION, schema: COMMITMENT_SCHEMA_VERSION, provider: OPENROUTER_PROVIDER_POLICY_VERSION, model: OPENROUTER_MODEL }, baseline, model: scoreCommitmentOutputs(outputs), frozen };
await mkdir("evaluation-results", { recursive: true });
const artifactName = `commitment-${COMMITMENT_CORPUS_VERSION}-${COMMITMENT_PROMPT_VERSION}-${manifest.generatedAt.replaceAll(":", "-")}.json`;
await writeFile(`evaluation-results/${artifactName}`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(manifest, null, 2));
