import { describe, expect, test } from "bun:test";
import { aggregateComparisons, assertEvaluationSeed } from "../src/simulation/evaluation";
import { contextHash, createDecisionManifest, FrozenRecoupDecisions, heuristicScore, RecoupDecisionSchema } from "../src/simulation/recoup-agent";
import { compareStrategies, DEFAULT_CONFIG, generatePortfolio, projectObservable } from "../src/simulation/simulator";

describe("suite provenance and frozen Recoup decisions", () => {
  test("named suite seed membership is fail-closed and aggregate is stable", () => {
    expect(() => assertEvaluationSeed("held-out", 42)).toThrow("custom");
    const comparisons = [42, 91, 123].map((seed) => compareStrategies({ caseCount: 5, days: 2, seed, evaluationSet: "development" }));
    const a = aggregateComparisons("development", comparisons);
    const b = aggregateComparisons("development", comparisons);
    expect(a).toEqual(b); expect(a.reconciliation.valid).toBe(true); expect(a.seeds).toEqual([42, 91, 123]);
  });

  test("agent schema and replay reject invalid/tampered data without network", () => {
    const context = projectObservable(generatePortfolio({ ...DEFAULT_CONFIG, caseCount: 1 }).cases[0], 0);
    const decision = RecoupDecisionSchema.parse({ action: "SEND_PAYMENT_LINK", intent: "PAY_NOW", promiseDate: null, promiseAmountPaise: null, disputeOrAmbiguity: false, urgency: "HIGH", relationshipRisk: "LOW", confidence: .8, reason: "Customer explicitly asks for a payment link." });
    const manifest = createDecisionManifest([{ contextHash: contextHash(context), promptVersion: "recoup-interpreter-1.0.0", schemaVersion: "1.0.0", providerId: "fake", model: "fake-1", decision }], "fake", "fake-1");
    expect(new FrozenRecoupDecisions(manifest).get(context).decision).toEqual(decision);
    const tampered = structuredClone(manifest); tampered.records[0].decision.confidence = 2;
    expect(() => new FrozenRecoupDecisions(tampered)).toThrow();
    expect(() => RecoupDecisionSchema.parse({ ...decision, promiseDate: "bad-date" })).toThrow();
    expect(heuristicScore(context, decision).score).toBeGreaterThan(0);
  });
});
