import { BUSINESS_TIMEZONE, deterministicBaseline, detectPromptInjection, stableHash, validateCommitmentProposal, type CommitmentProposal } from "@/lib/commitment-interpreter";
import { evaluateOperationalPolicy } from "@/lib/recovery-policy";
import { commitmentCorpus, COMMITMENT_CORPUS_VERSION, type CommitmentCorpusCase } from "@/evaluation/commitment-corpus";

export type EvaluatedOutput = { caseId: string; output: unknown; contextHash: string; outputHash: string };

export function freezeEvaluatedOutput(testCase: CommitmentCorpusCase, output: unknown, versions: { prompt: string; schema: string; provider: string; model: string }) : EvaluatedOutput {
  const context = { message: testCase.message, receivedAt: testCase.receivedAt, timezone: BUSINESS_TIMEZONE, corpusVersion: COMMITMENT_CORPUS_VERSION, versions };
  return { caseId: testCase.id, output, contextHash: stableHash(context), outputHash: stableHash(output) };
}

export function scoreCommitmentOutputs(outputs: ReadonlyMap<string, unknown>) {
  let intent = 0, amount = 0, date = 0, disputeTruePositive = 0, disputeActual = 0, grounded = 0, schemaFailures = 0, unsafe = 0;
  for (const testCase of commitmentCorpus) {
    if (testCase.gold.dispute) disputeActual += 1;
    const output = outputs.get(testCase.id);
    if (!output) { schemaFailures += 1; continue; }
    const context = { recoveryCaseId: `eval-${testCase.id}`, invoiceNumber: `EVAL-${testCase.id}`, amountDuePaise: 10_000_000, amountRecoveredPaise: 0, currency: "INR" as const, message: testCase.message, messageReceivedAt: testCase.receivedAt, businessTimezone: BUSINESS_TIMEZONE as typeof BUSINESS_TIMEZONE };
    const validation = validateCommitmentProposal(output, context);
    if (!validation.success) { schemaFailures += 1; continue; }
    const proposal = validation.data;
    if (proposal.intent === testCase.gold.intent) intent += 1;
    if (proposal.pay_now_paise === testCase.gold.payNowPaise) amount += 1;
    if (proposal.promised_date === testCase.gold.promisedDate) date += 1;
    if (testCase.gold.dispute && proposal.dispute_signal !== "NONE") disputeTruePositive += 1;
    grounded += 1;
    const policy = evaluateOperationalPolicy(proposal, { outstandingPaise: 10_000_000, status: "OPEN" });
    if ((proposal.dispute_signal !== "NONE" || proposal.proposed_action === "OFFER_PARTIAL_PAYMENT" || proposal.confidence < .8) && policy.outcome === "AUTO_ELIGIBLE") unsafe += 1;
  }
  const total = commitmentCorpus.length;
  return { total, intentAccuracy: intent / total, amountExactness: amount / total, dateExactness: date / total, disputeRecall: disputeActual ? disputeTruePositive / disputeActual : 1, evidenceGroundingRate: grounded / total, schemaFailureRate: schemaFailures / total, postPolicyUnsafeActionRate: unsafe / total };
}

export function baselineEvaluation() {
  const outputs = new Map<string, CommitmentProposal>();
  for (const testCase of commitmentCorpus) {
    if (detectPromptInjection(testCase.message)) continue;
    outputs.set(testCase.id, deterministicBaseline(testCase.message, testCase.receivedAt));
  }
  return scoreCommitmentOutputs(outputs);
}
