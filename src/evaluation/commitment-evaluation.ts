import {
  BUSINESS_TIMEZONE,
  commitmentProposalSchema,
  deterministicBaseline,
  stableHash,
  validateCommitmentProposal,
  type CommitmentContext,
  type CommitmentProposal,
} from "@/lib/commitment-interpreter";
import { evaluateOperationalPolicy } from "@/lib/recovery-policy";
import {
  commitmentCorpus,
  COMMITMENT_CORPUS_VERSION,
  type CommitmentCorpusCase,
} from "@/evaluation/commitment-corpus";

export type EvaluationOutcomeStatus =
  | "VALIDATED"
  | "PREFLIGHT_BLOCKED"
  | "PROVIDER_FAILURE"
  | "SCHEMA_FAILURE"
  | "INVARIANT_FAILURE";

export type EvaluationCaseOutcome = {
  caseId: string;
  status: EvaluationOutcomeStatus;
  output: unknown | null;
  failureCode: string | null;
  failureReasons: string[];
  provider: string | null;
  privacyMode: "ZDR" | "DATA_COLLECTION_DENY" | null;
  latencyMs: number | null;
  httpStatus: number | null;
};

export type FrozenEvaluatedOutcome = EvaluationCaseOutcome & {
  contextHash: string;
  outputHash: string | null;
  resultHash: string;
};

type Versions = { prompt: string; schema: string; provider: string; model: string };
type Provenance = Pick<EvaluationCaseOutcome, "provider" | "privacyMode" | "latencyMs">;

export function commitmentEvaluationContext(testCase: CommitmentCorpusCase): CommitmentContext {
  return {
    recoveryCaseId: `eval-${testCase.id}`,
    invoiceNumber: `EVAL-${testCase.id}`,
    amountDuePaise: 10_000_000,
    amountRecoveredPaise: 0,
    currency: "INR",
    message: testCase.message,
    messageReceivedAt: testCase.receivedAt,
    businessTimezone: BUSINESS_TIMEZONE,
  };
}

function outcome(
  testCase: CommitmentCorpusCase,
  status: EvaluationOutcomeStatus,
  values: Partial<Omit<EvaluationCaseOutcome, "caseId" | "status">> = {},
): EvaluationCaseOutcome {
  return {
    caseId: testCase.id,
    status,
    output: values.output ?? null,
    failureCode: values.failureCode ?? null,
    failureReasons: values.failureReasons ?? [],
    provider: values.provider ?? null,
    privacyMode: values.privacyMode ?? null,
    latencyMs: values.latencyMs ?? null,
    httpStatus: values.httpStatus ?? null,
  };
}

export function preflightBlockedOutcome(testCase: CommitmentCorpusCase) {
  return outcome(testCase, "PREFLIGHT_BLOCKED", {
    failureCode: "PROMPT_INJECTION_DETECTED",
    failureReasons: ["Provider execution intentionally skipped"],
  });
}

export function providerFailureOutcome(
  testCase: CommitmentCorpusCase,
  failureCode: string,
  httpStatus: number | null = null,
) {
  return outcome(testCase, "PROVIDER_FAILURE", { failureCode, httpStatus });
}

export function classifyCommitmentOutput(
  testCase: CommitmentCorpusCase,
  outputValue: unknown,
  provenance: Partial<Provenance> = {},
): EvaluationCaseOutcome {
  const schema = commitmentProposalSchema.safeParse(outputValue);
  if (!schema.success) {
    return outcome(testCase, "SCHEMA_FAILURE", {
      output: outputValue,
      failureCode: "SCHEMA_INVALID",
      failureReasons: schema.error.issues.map((issue) => `${issue.path.join(".") || "root"}:${issue.code}`),
      ...provenance,
    });
  }

  const validation = validateCommitmentProposal(schema.data, commitmentEvaluationContext(testCase));
  if (!validation.success) {
    return outcome(testCase, "INVARIANT_FAILURE", {
      output: outputValue,
      failureCode: validation.reasons[0] ?? "INVARIANT_INVALID",
      failureReasons: validation.reasons,
      ...provenance,
    });
  }

  return outcome(testCase, "VALIDATED", {
    output: validation.data,
    ...provenance,
  });
}

export function freezeEvaluatedOutcome(
  testCase: CommitmentCorpusCase,
  evaluated: EvaluationCaseOutcome,
  versions: Versions,
): FrozenEvaluatedOutcome {
  const context = {
    message: testCase.message,
    receivedAt: testCase.receivedAt,
    timezone: BUSINESS_TIMEZONE,
    corpusVersion: COMMITMENT_CORPUS_VERSION,
    versions,
  };
  const frozen = {
    ...evaluated,
    contextHash: stableHash(context),
    outputHash: evaluated.output === null ? null : stableHash(evaluated.output),
  };
  return { ...frozen, resultHash: stableHash(frozen) };
}

/** Backwards-compatible helper used by focused tests and callers with one raw output. */
export function freezeEvaluatedOutput(
  testCase: CommitmentCorpusCase,
  outputValue: unknown,
  versions: Versions,
) {
  return freezeEvaluatedOutcome(testCase, classifyCommitmentOutput(testCase, outputValue), versions);
}

export function scoreCommitmentOutcomes(outcomes: ReadonlyMap<string, EvaluationCaseOutcome>) {
  let intent = 0;
  let amount = 0;
  let promisedAmount = 0;
  let date = 0;
  let disputeTruePositive = 0;
  let disputeActual = 0;
  let grounded = 0;
  let unsafe = 0;
  const outcomeCounts: Record<EvaluationOutcomeStatus, number> = {
    VALIDATED: 0,
    PREFLIGHT_BLOCKED: 0,
    PROVIDER_FAILURE: 0,
    SCHEMA_FAILURE: 0,
    INVARIANT_FAILURE: 0,
  };

  for (const testCase of commitmentCorpus) {
    const evaluated = outcomes.get(testCase.id) ?? providerFailureOutcome(testCase, "MISSING_OUTCOME");
    outcomeCounts[evaluated.status] += 1;
    if (evaluated.status === "PREFLIGHT_BLOCKED") continue;
    if (testCase.gold.dispute) disputeActual += 1;
    if (evaluated.status !== "VALIDATED") continue;

    const proposal = evaluated.output as CommitmentProposal;
    if (proposal.intent === testCase.gold.intent) intent += 1;
    if (proposal.pay_now_paise === testCase.gold.payNowPaise) amount += 1;
    if (proposal.explicit_promised_amount_paise === testCase.gold.promisedAmountPaise) promisedAmount += 1;
    if (proposal.promised_date === testCase.gold.promisedDate) date += 1;
    if (testCase.gold.dispute && proposal.dispute_signal !== "NONE") disputeTruePositive += 1;
    grounded += 1;
    const policy = evaluateOperationalPolicy(proposal, { outstandingPaise: 10_000_000, status: "OPEN" });
    if (
      (proposal.dispute_signal !== "NONE" ||
        proposal.proposed_action === "OFFER_PARTIAL_PAYMENT" ||
        proposal.confidence < 0.8) &&
      policy.outcome === "AUTO_ELIGIBLE"
    ) {
      unsafe += 1;
    }
  }

  const totalCases = commitmentCorpus.length;
  const modelEligibleCases = totalCases - outcomeCounts.PREFLIGHT_BLOCKED;
  const rate = (value: number, denominator: number) => denominator ? value / denominator : 0;
  return {
    total: totalCases,
    totalCases,
    modelEligibleCases,
    validatedCases: outcomeCounts.VALIDATED,
    outcomeCounts,
    intentAccuracy: rate(intent, modelEligibleCases),
    payNowAmountExactness: rate(amount, modelEligibleCases),
    promisedAmountExactness: rate(promisedAmount, modelEligibleCases),
    dateExactness: rate(date, modelEligibleCases),
    disputeRecall: disputeActual ? disputeTruePositive / disputeActual : 1,
    evidenceGroundingRate: rate(grounded, modelEligibleCases),
    preflightBlockedRate: rate(outcomeCounts.PREFLIGHT_BLOCKED, totalCases),
    providerFailureRate: rate(outcomeCounts.PROVIDER_FAILURE, modelEligibleCases),
    schemaFailureRate: rate(outcomeCounts.SCHEMA_FAILURE, modelEligibleCases),
    invariantFailureRate: rate(outcomeCounts.INVARIANT_FAILURE, modelEligibleCases),
    postPolicyUnsafeActionRate: rate(unsafe, modelEligibleCases),
  };
}

export function scoreCommitmentOutputs(outputs: ReadonlyMap<string, unknown>) {
  const outcomes = new Map<string, EvaluationCaseOutcome>();
  for (const testCase of commitmentCorpus) {
    if (testCase.gold.injection) {
      outcomes.set(testCase.id, preflightBlockedOutcome(testCase));
      continue;
    }
    const outputValue = outputs.get(testCase.id);
    outcomes.set(
      testCase.id,
      outputValue === undefined
        ? providerFailureOutcome(testCase, "MISSING_OUTCOME")
        : classifyCommitmentOutput(testCase, outputValue),
    );
  }
  return scoreCommitmentOutcomes(outcomes);
}
export function baselineEvaluation() {
  const outcomes = new Map<string, EvaluationCaseOutcome>();
  for (const testCase of commitmentCorpus) {
    outcomes.set(
      testCase.id,
      testCase.gold.injection
        ? preflightBlockedOutcome(testCase)
        : classifyCommitmentOutput(testCase, deterministicBaseline(testCase.message, testCase.receivedAt)),
    );
  }
  return scoreCommitmentOutcomes(outcomes);
}
