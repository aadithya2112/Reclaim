import type { EvaluationSetName, HiddenCustomerState, Profile, ScenarioManifest, ScenarioName } from "./types";

export const EVALUATION_SET_MANIFEST: { schemaVersion: "1.0.0"; sets: Record<Exclude<EvaluationSetName, "custom">, readonly number[]> } = {
  schemaVersion: "1.0.0",
  sets: { development: [42, 91, 123], "held-out": [2027, 3407, 9811] },
};

export const SCENARIO_MANIFESTS: Record<ScenarioName, ScenarioManifest> = {
  conservative: { schemaVersion: "1.0.0", name: "conservative", version: "2026-08-30.1", description: "Small intervention effects, more spontaneous recovery, and costly contacts.", assumptions: { spontaneousPaymentMultiplier: 1.35, responsivenessMultiplier: .82, paymentAbilityMultiplier: .88, willingnessMultiplier: .90, promiseReliabilityMultiplier: .85, disputePropensityMultiplier: 1.15, contactCostMultiplier: 1.3, actionModifiers: { SEND_GENTLE_REMINDER: .96, SEND_PAYMENT_REMINDER: .98, SEND_PAYMENT_LINK: 1.02, REQUEST_PAYMENT_COMMITMENT: .96, FOLLOW_UP_PROMISE: .94 }, relationshipRules: "No special account treatment beyond disclosed higher contact cost." } },
  standard: { schemaVersion: "1.0.0", name: "standard", version: "2026-08-30.1", description: "Central hand-authored synthetic assumptions; not calibrated probabilities.", assumptions: { spontaneousPaymentMultiplier: 1, responsivenessMultiplier: 1, paymentAbilityMultiplier: 1, willingnessMultiplier: 1, promiseReliabilityMultiplier: 1, disputePropensityMultiplier: 1, contactCostMultiplier: 1, actionModifiers: { SEND_GENTLE_REMINDER: 1, SEND_PAYMENT_REMINDER: 1, SEND_PAYMENT_LINK: 1.15, REQUEST_PAYMENT_COMMITMENT: 1, FOLLOW_UP_PROMISE: 1 }, relationshipRules: "Observable histories influence strategy only; no undisclosed relationship effect." } },
  adversarial: { schemaVersion: "1.0.0", name: "adversarial", version: "2026-08-30.1", description: "Low responsiveness, weaker promises, more disputes, and delayed/less likely payments.", assumptions: { spontaneousPaymentMultiplier: .7, responsivenessMultiplier: .62, paymentAbilityMultiplier: .74, willingnessMultiplier: .76, promiseReliabilityMultiplier: .58, disputePropensityMultiplier: 1.75, contactCostMultiplier: 1.15, actionModifiers: { SEND_GENTLE_REMINDER: .84, SEND_PAYMENT_REMINDER: .88, SEND_PAYMENT_LINK: .92, REQUEST_PAYMENT_COMMITMENT: .82, FOLLOW_UP_PROMISE: .76 }, relationshipRules: "No special account treatment; outcomes intentionally stress interventions." } },
  "relationship-sensitive": { schemaVersion: "1.0.0", name: "relationship-sensitive", version: "2026-08-30.1", description: "Strategic relationships impose stricter contact economics and softer escalation assumptions.", assumptions: { spontaneousPaymentMultiplier: 1.08, responsivenessMultiplier: .92, paymentAbilityMultiplier: .97, willingnessMultiplier: .98, promiseReliabilityMultiplier: .93, disputePropensityMultiplier: 1.2, contactCostMultiplier: 1.55, actionModifiers: { SEND_GENTLE_REMINDER: 1.03, SEND_PAYMENT_REMINDER: .90, SEND_PAYMENT_LINK: .94, REQUEST_PAYMENT_COMMITMENT: .86, FOLLOW_UP_PROMISE: .88 }, relationshipRules: "High-value and historically reliable accounts have greater relationship cost; existing high-value human-review rule remains enforced." } },
};

const baseTraits: Record<Profile, Omit<HiddenCustomerState, "profile">> = {
  RELIABLE_LATE_PAYER: { responsiveness: .82, paymentAbility: .82, willingness: .92, disputePropensity: .02, promiseReliability: .86, partialTendency: .12, spontaneousPayment: .025 },
  CASHFLOW_CONSTRAINED: { responsiveness: .7, paymentAbility: .38, willingness: .85, disputePropensity: .04, promiseReliability: .48, partialTendency: .62, spontaneousPayment: .008 },
  LOW_RESPONSIVENESS: { responsiveness: .2, paymentAbility: .68, willingness: .58, disputePropensity: .04, promiseReliability: .55, partialTendency: .22, spontaneousPayment: .004 },
  DISPUTE_PRONE: { responsiveness: .68, paymentAbility: .72, willingness: .48, disputePropensity: .32, promiseReliability: .52, partialTendency: .18, spontaneousPayment: .003 },
  HIGH_RISK: { responsiveness: .3, paymentAbility: .2, willingness: .3, disputePropensity: .14, promiseReliability: .2, partialTendency: .35, spontaneousPayment: .001 },
};

export const scenarioManifest = (name: ScenarioName) => SCENARIO_MANIFESTS[name];
export function profileTraits(profile: Profile, name: ScenarioName): HiddenCustomerState {
  const t = baseTraits[profile]; const a = scenarioManifest(name).assumptions;
  return { profile, responsiveness: t.responsiveness * a.responsivenessMultiplier, paymentAbility: t.paymentAbility * a.paymentAbilityMultiplier, willingness: t.willingness * a.willingnessMultiplier, disputePropensity: Math.min(1, t.disputePropensity * a.disputePropensityMultiplier), promiseReliability: t.promiseReliability * a.promiseReliabilityMultiplier, partialTendency: t.partialTendency, spontaneousPayment: t.spontaneousPayment * a.spontaneousPaymentMultiplier };
}
