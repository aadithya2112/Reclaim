import { createHash } from "node:crypto";
import { keyedUnit } from "./random";
import { scenarioManifest } from "./scenarios";
import { SIMULATOR_VERSION } from "./types";
import type { PotentialOutcomeBank, RecoveryAction, SimulationCase, SimulationConfig } from "./types";

export const CONTACT_ACTIONS: RecoveryAction[] = ["SEND_GENTLE_REMINDER", "SEND_PAYMENT_REMINDER", "SEND_PAYMENT_LINK", "REQUEST_PAYMENT_COMMITMENT", "FOLLOW_UP_PROMISE"];
export const stableJson = (value: unknown): string => Array.isArray(value) ? `[${value.map(stableJson).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}` : JSON.stringify(value);
const hash = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex");
export const normalizeEnvironmentConfig = (config: SimulationConfig): Omit<SimulationConfig, "strategy"> => ({ seed: config.seed, caseCount: config.caseCount, days: config.days, startDate: config.startDate, scenario: config.scenario, evaluationSet: config.evaluationSet, policy: config.policy, capacity: config.capacity });

export function createPotentialOutcomeBank(config: SimulationConfig, cases: readonly SimulationCase[]): PotentialOutcomeBank {
  const caseIds = cases.map((c) => c.id).sort(); const normalizedConfig = normalizeEnvironmentConfig(config);
  const outcomes: PotentialOutcomeBank["outcomes"] = {};
  for (const caseId of caseIds) {
    const spontaneousByDay: Record<string, number> = {}; const actionsByDay: PotentialOutcomeBank["outcomes"][string]["actionsByDay"] = {}; const promiseByCreation: PotentialOutcomeBank["outcomes"][string]["promiseByCreation"] = {};
    for (let day = 0; day < config.days; day++) {
      spontaneousByDay[String(day)] = keyedUnit(config.seed, "bank", caseId, day, "spontaneous"); actionsByDay[String(day)] = {}; promiseByCreation[String(day)] = {};
      for (let ordinal = 1; ordinal <= config.policy.maxContactAttempts; ordinal++) {
        promiseByCreation[String(day)][String(ordinal)] = { realizationUnit: keyedUnit(config.seed, "bank", caseId, day, ordinal, "promise-realization"), fullPaymentUnit: keyedUnit(config.seed, "bank", caseId, day, ordinal, "promise-full") };
        for (const action of CONTACT_ACTIONS) {
          actionsByDay[String(day)][action] ??= {};
          actionsByDay[String(day)][action][String(ordinal)] = { responseUnit: keyedUnit(config.seed, "bank", caseId, day, action, ordinal, "response"), outcomeUnit: keyedUnit(config.seed, "bank", caseId, day, action, ordinal, "outcome"), partialPaymentUnit: keyedUnit(config.seed, "bank", caseId, day, action, ordinal, "partial"), promiseAmountUnit: keyedUnit(config.seed, "bank", caseId, day, action, ordinal, "promise-amount"), promiseDueUnit: keyedUnit(config.seed, "bank", caseId, day, action, ordinal, "promise-due") };
        }
      }
    }
    outcomes[caseId] = { spontaneousByDay, actionsByDay, promiseByCreation };
  }
  const base = { schemaVersion: "1.0.0" as const, simulatorVersion: SIMULATOR_VERSION, scenarioVersion: scenarioManifest(config.scenario).version, scenarioName: config.scenario, normalizedConfig, caseIds, supportedContactActions: CONTACT_ACTIONS, outcomes };
  return { ...base, sha256: hash(base) };
}

export function validatePotentialOutcomeBank(bank: PotentialOutcomeBank, config: SimulationConfig, cases: readonly SimulationCase[]): void {
  const expected = createPotentialOutcomeBank(config, cases);
  const content = { schemaVersion: bank.schemaVersion, simulatorVersion: bank.simulatorVersion, scenarioVersion: bank.scenarioVersion, scenarioName: bank.scenarioName, normalizedConfig: bank.normalizedConfig, caseIds: bank.caseIds, supportedContactActions: bank.supportedContactActions, outcomes: bank.outcomes };
  if (bank.sha256 !== hash(content)) throw new Error("Potential-outcome bank hash is invalid or bank was tampered");
  if (bank.schemaVersion !== expected.schemaVersion || bank.simulatorVersion !== expected.simulatorVersion || bank.scenarioVersion !== expected.scenarioVersion || bank.scenarioName !== expected.scenarioName) throw new Error("Potential-outcome bank schema or scenario is incompatible");
  if (stableJson(bank.normalizedConfig) !== stableJson(expected.normalizedConfig) || stableJson(bank.caseIds) !== stableJson(expected.caseIds) || stableJson(bank.supportedContactActions) !== stableJson(expected.supportedContactActions)) throw new Error("Potential-outcome bank configuration is incompatible");
  if (stableJson(bank.outcomes) !== stableJson(expected.outcomes)) throw new Error("Potential-outcome bank is incomplete, malformed, or incompatible");
}
