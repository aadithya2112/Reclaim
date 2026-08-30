import { createHash } from "node:crypto";
import { keyedInt, keyedUnit, stableId } from "./random";
import type { AuditEvent, HiddenCustomerState, ObservableRecoveryContext, PolicyConfig, PolicyResult, Profile, RecoveryAction, RecoveryDecision, RecoveryState, RecoveryStrategy, SimulationCase, SimulationConfig, SimulationMetrics, SimulationResult, SyntheticPaymentEvent } from "./types";
import { SIMULATOR_VERSION } from "./types";

export const DEFAULT_POLICY: PolicyConfig = { maxContactAttempts: 5, cooldownDays: 2, highValueThresholdPaise: 2_000_000 };
export const DEFAULT_CONFIG: SimulationConfig = { seed: 42, caseCount: 1000, days: 30, startDate: "2026-01-01", strategy: "baseline", scenario: "standard", policy: DEFAULT_POLICY };
const CONTACTS = new Set<RecoveryAction>(["SEND_GENTLE_REMINDER", "SEND_PAYMENT_REMINDER", "SEND_PAYMENT_LINK", "REQUEST_PAYMENT_COMMITMENT", "FOLLOW_UP_PROMISE"]);
const TERMINAL = new Set<RecoveryState>(["DISPUTED", "ESCALATED", "RECOVERED", "CLOSED"]);
const profiles: Profile[] = ["RELIABLE_LATE_PAYER", "CASHFLOW_CONSTRAINED", "LOW_RESPONSIVENESS", "DISPUTE_PRONE", "HIGH_RISK"];
const traits: Record<Profile, Omit<HiddenCustomerState, "profile">> = {
  RELIABLE_LATE_PAYER: { responsiveness:.82, paymentAbility:.82, willingness:.92, disputePropensity:.02, promiseReliability:.86, partialTendency:.12, spontaneousPayment:.025 },
  CASHFLOW_CONSTRAINED: { responsiveness:.7, paymentAbility:.38, willingness:.85, disputePropensity:.04, promiseReliability:.48, partialTendency:.62, spontaneousPayment:.008 },
  LOW_RESPONSIVENESS: { responsiveness:.2, paymentAbility:.68, willingness:.58, disputePropensity:.04, promiseReliability:.55, partialTendency:.22, spontaneousPayment:.004 },
  DISPUTE_PRONE: { responsiveness:.68, paymentAbility:.72, willingness:.48, disputePropensity:.32, promiseReliability:.52, partialTendency:.18, spontaneousPayment:.003 },
  HIGH_RISK: { responsiveness:.3, paymentAbility:.2, willingness:.3, disputePropensity:.14, promiseReliability:.2, partialTendency:.35, spontaneousPayment:.001 },
};
const clone = <T>(value: T): T => structuredClone(value);
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
};
const isoDay = (start: string, day: number) => new Date(`${start}T00:00:00.000Z`).valueOf() + day * 86_400_000;
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function generatePortfolio(config: SimulationConfig): { cases: SimulationCase[]; hidden: Record<string, HiddenCustomerState> } {
  const cases: SimulationCase[] = []; const hidden: Record<string, HiddenCustomerState> = {};
  const buckets = [[1,5],[6,15],[16,30],[31,60],[61,100]];
  for (let i=0;i<config.caseCount;i++) {
    const id = `sim-case-${String(i+1).padStart(6,"0")}`; const profile = profiles[keyedInt(config.seed,0,profiles.length-1,"profile",i)];
    hidden[id] = { profile, ...traits[profile] };
    const amountRoll=keyedUnit(config.seed,"amount-tier",i); const [lo,hi]=amountRoll<.45?[5_000,50_000]:amountRoll<.8?[50_001,300_000]:amountRoll<.97?[300_001,2_000_000]:[2_000_001,10_000_000];
    const amount=keyedInt(config.seed,lo,hi,"amount",i); const bucket=buckets[keyedInt(config.seed,0,4,"overdue-bucket",i)]; const overdue=keyedInt(config.seed,bucket[0],bucket[1],"overdue",i);
    const partial=keyedUnit(config.seed,"initial-partial",i)<.09; const recovered=partial?Math.floor(amount*keyedInt(config.seed,10,45,"initial-partial-pct",i)/100):0;
    const attempts=keyedUnit(config.seed,"attempted",i)<.18?keyedInt(config.seed,1,3,"attempts",i):0; const dispute=profile==="DISPUTE_PRONE"&&keyedUnit(config.seed,"initial-dispute",i)<.12;
    const history={historicalInvoices:keyedInt(config.seed,1,18,"hist",i),historicalLatePayments:keyedInt(config.seed,0,6,"late",i),priorPromises:keyedInt(config.seed,0,3,"promises",i),priorPromisesFulfilled:keyedInt(config.seed,0,2,"fulfilled",i),priorDisputes:keyedInt(config.seed,0,profile==="DISPUTE_PRONE"?3:1,"disputes",i),riskSegment:(profile==="HIGH_RISK"?"HIGH":profile==="RELIABLE_LATE_PAYER"?"LOW":"MEDIUM") as "LOW"|"MEDIUM"|"HIGH"};
    const dueMs=isoDay(config.startDate,-overdue); const c: SimulationCase={id,customerId:`sim-customer-${String(i+1).padStart(6,"0")}`,invoiceId:`SYN-INV-${String(i+1).padStart(6,"0")}`,originalAmountPaise:amount,startingOutstandingPaise:amount-recovered,outstandingPaise:amount-recovered,recoveredPaise:recovered,initialRecoveredPaise:recovered,invoiceIssueDate:dateOnly(dueMs-30*86_400_000),dueDate:dateOnly(dueMs),initialDaysOverdue:overdue,state:dispute?"DISPUTED":partial?"PARTIALLY_PAID":attempts?"CONTACTED":"OPEN",contactAttempts:attempts,lastContactDay:attempts?-keyedInt(config.seed,1,5,"last-contact",i):null,history,promises:[],dispute,escalated:false,closed:false,recoveredDay:null};
    cases.push(c);
  } return { cases, hidden };
}

export function projectObservable(c: SimulationCase, day: number): ObservableRecoveryContext { return { ...clone(c), simulationDay:day, daysOverdue:c.initialDaysOverdue+day }; }
export class BaselineStrategy implements RecoveryStrategy {
  readonly name="baseline";
  decide(c: ObservableRecoveryContext): RecoveryDecision {
    if (c.outstandingPaise===0 || TERMINAL.has(c.state)) return {action:"WAIT",reason:"Case is paid or terminal; automation stops."};
    const active=c.promises.find(p=>p.status==="ACTIVE"); if(active&&active.dueDay>=c.simulationDay)return {action:"WAIT",reason:"Active promise is protected."};
    if(c.contactAttempts>=5)return {action:"ESCALATE_TO_HUMAN",reason:"Maximum automated attempts reached."};
    if(c.outstandingPaise>=2_000_000)return {action:"ESCALATE_TO_HUMAN",reason:"High-value balance requires human review."};
    if(c.promises.some(p=>p.status==="BROKEN"))return {action:"FOLLOW_UP_PROMISE",reason:"Observable promise was broken."};
    if(c.daysOverdue<=5)return {action:"SEND_GENTLE_REMINDER",reason:"Recently overdue invoice."};
    if(c.daysOverdue<=15)return {action:"SEND_PAYMENT_REMINDER",reason:"Moderately overdue invoice."};
    if(c.daysOverdue<=30)return {action:"SEND_PAYMENT_LINK",reason:"Payment link may reduce payment friction."};
    if(c.daysOverdue<=60)return {action:"REQUEST_PAYMENT_COMMITMENT",reason:"Long-overdue invoice needs a dated commitment."};
    return {action:"ESCALATE_TO_HUMAN",reason:"Heavily overdue invoice requires review."};
  }
}
export function evaluatePolicy(c: ObservableRecoveryContext, proposed: RecoveryAction, policy: PolicyConfig): PolicyResult {
  const blocked=(reason:string,rule:string,executedAction:RecoveryAction="WAIT"):PolicyResult=>({proposedAction:proposed,allowed:false,reason,executedAction,rule});
  if(c.outstandingPaise===0||c.state==="RECOVERED"||c.state==="CLOSED")return blocked("Paid or terminal case cannot be automated.","TERMINAL_STOP");
  if(c.dispute||c.state==="DISPUTED")return blocked("Disputed case cannot receive automated collection.","DISPUTE_STOP");
  if(c.escalated||c.state==="ESCALATED")return blocked("Escalated case cannot receive automated collection.","ESCALATION_STOP");
  if(CONTACTS.has(proposed)&&c.promises.some(p=>p.status==="ACTIVE"&&p.dueDay>=c.simulationDay))return blocked("Active promise suppresses contact.","PROMISE_PROTECTION");
  if(CONTACTS.has(proposed)&&c.contactAttempts>=policy.maxContactAttempts)return blocked("Automated contact limit reached.","CONTACT_LIMIT","ESCALATE_TO_HUMAN");
  if(CONTACTS.has(proposed)&&c.lastContactDay!==null&&c.simulationDay-c.lastContactDay<policy.cooldownDays)return blocked("Contact cooldown has not elapsed.","COOLDOWN");
  if(CONTACTS.has(proposed)&&c.outstandingPaise>=policy.highValueThresholdPaise)return blocked("High-value case requires human review.","HIGH_VALUE","ESCALATE_TO_HUMAN");
  return {proposedAction:proposed,allowed:true,reason:"Action satisfies policy.",executedAction:proposed};
}
function transition(c: SimulationCase,next:RecoveryState): boolean { if(TERMINAL.has(c.state))return c.state===next; c.state=next; c.dispute=next==="DISPUTED"; c.escalated=next==="ESCALATED"; c.closed=next==="CLOSED"; return true; }

export function runSimulation(input: Partial<SimulationConfig> = {}, strategy: RecoveryStrategy = new BaselineStrategy()): SimulationResult {
  const config:SimulationConfig={...DEFAULT_CONFIG,...input,policy:{...DEFAULT_POLICY,...input.policy}}; if(!Number.isInteger(config.seed)||config.caseCount<1||config.days<1)throw new Error("seed must be an integer; cases and days must be positive integers");
  const normalized=stableJson(config); const runId=createHash("sha256").update(`${SIMULATOR_VERSION}|${normalized}`).digest("hex").slice(0,16);
  const generated=generatePortfolio(config); const initialPortfolio=clone(generated.cases); const cases=clone(generated.cases); const events:AuditEvent[]=[]; const payments:SyntheticPaymentEvent[]=[]; const paymentEvents=new Set<string>(); const paymentIds=new Set<string>(); let eventIndex=0;
  const audit=(c:SimulationCase,day:number,type:string,source:AuditEvent["source"],reason:string,extra:Partial<AuditEvent>={})=>events.push({eventId:`sim-audit-${String(++eventIndex).padStart(9,"0")}`,runId,caseId:c.id,simulationDay:day,simulatedAt:new Date(isoDay(config.startDate,day)).toISOString(),type,source,reason,...extra});
  const applyPayment=(c:SimulationCase,p:SyntheticPaymentEvent)=>{ if(paymentEvents.has(p.eventId)||paymentIds.has(p.paymentId)){audit(c,p.simulationDay,"DUPLICATE_PAYMENT_IGNORED","SIMULATION","Duplicate synthetic payment ignored.",{amountPaise:p.amountPaise});return 0;} paymentEvents.add(p.eventId);paymentIds.add(p.paymentId); const accepted=Math.min(Math.max(0,p.amountPaise),c.outstandingPaise); if(!accepted)return 0; c.outstandingPaise-=accepted;c.recoveredPaise+=accepted;payments.push({...p,amountPaise:accepted}); const promise=p.promiseId?c.promises.find(x=>x.id===p.promiseId):undefined; if(promise){promise.amountFulfilledPaise=Math.min(promise.amountPaise,promise.amountFulfilledPaise+accepted);promise.paymentIds.push(p.paymentId);promise.status=promise.amountFulfilledPaise>=promise.amountPaise?"FULFILLED":"PARTIALLY_FULFILLED";audit(c,p.simulationDay,promise.status==="FULFILLED"?"PROMISE_FULFILLED":"PROMISE_PARTIALLY_FULFILLED","SIMULATION","Scheduled promise payment applied.",{amountPaise:accepted});} if(c.outstandingPaise===0){transition(c,"RECOVERED");c.recoveredDay=p.simulationDay;audit(c,p.simulationDay,"CASE_RECOVERED","SIMULATION","Outstanding balance reached zero.",{amountPaise:accepted});}else{transition(c,"PARTIALLY_PAID");audit(c,p.simulationDay,"PARTIAL_PAYMENT_RECEIVED","SIMULATION",p.reason,{amountPaise:accepted});} return accepted;};
  for(const c of cases)audit(c,0,"CASE_CREATED","SIMULATION","Synthetic recovery case generated.",{amountPaise:c.startingOutstandingPaise});
  for(let day=0;day<config.days;day++) for(const c of cases){
    if(TERMINAL.has(c.state))continue;
    for(const p of c.promises.filter(p=>p.status==="ACTIVE"&&p.dueDay===day)){ if(keyedUnit(config.seed,c.id,day,"promise-realization",p.id)<generated.hidden[c.id].promiseReliability){const fraction=keyedUnit(config.seed,c.id,day,"promise-full",p.id)<.75?1:.5;applyPayment(c,{eventId:stableId("sim-event",config.seed,c.id,day,p.id),paymentId:stableId("sim-payment",config.seed,c.id,day,p.id),caseId:c.id,amountPaise:Math.floor(p.amountPaise*fraction),simulationDay:day,source:"SIMULATION",reason:"Synthetic promise realization.",promiseId:p.id});}}
    for(const p of c.promises.filter(p=>p.status==="ACTIVE"&&p.dueDay<day)){p.status="BROKEN";audit(c,day,"PROMISE_BROKEN","SIMULATION","Promise remained unpaid after its due day.");if(c.state==="PROMISED")transition(c,"CONTACTED");}
    if(TERMINAL.has(c.state))continue;
    if(keyedUnit(config.seed,c.id,day,"spontaneous")<generated.hidden[c.id].spontaneousPayment)applyPayment(c,{eventId:stableId("sim-event",config.seed,c.id,day,"spontaneous"),paymentId:stableId("sim-payment",config.seed,c.id,day,"spontaneous"),caseId:c.id,amountPaise:c.outstandingPaise,simulationDay:day,source:"SIMULATION",reason:"Synthetic spontaneous payment."});
    if(TERMINAL.has(c.state))continue; const context=projectObservable(c,day);audit(c,day,"CASE_EVALUATED","STRATEGY","Observable case evaluated."); const decision=strategy.decide(context);audit(c,day,"ACTION_PROPOSED","STRATEGY",decision.reason,{action:decision.action,metadata:decision.metadata}); const policy=evaluatePolicy(context,decision.action,config.policy);audit(c,day,policy.allowed?"ACTION_ALLOWED":"ACTION_BLOCKED","POLICY",policy.reason,{action:policy.executedAction,metadata:{proposedAction:decision.action,rule:policy.rule}}); const action=policy.executedAction;audit(c,day,"ACTION_EXECUTED","POLICY",policy.reason,{action});
    if(action==="ESCALATE_TO_HUMAN"){transition(c,"ESCALATED");audit(c,day,"CASE_ESCALATED","POLICY","Automation handed case to a human.");continue;} if(action==="CLOSE_CASE"){transition(c,"CLOSED");audit(c,day,"CASE_CLOSED","POLICY","Case closed.");continue;} if(!CONTACTS.has(action))continue;
    c.contactAttempts++;c.lastContactDay=day;transition(c,"CONTACTED");audit(c,day,"CUSTOMER_CONTACTED","SIMULATION","Synthetic contact executed.",{action}); const h=generated.hidden[c.id]; const response=keyedUnit(config.seed,c.id,day,action,c.contactAttempts,"response"); if(response>h.responsiveness){audit(c,day,"CUSTOMER_NO_RESPONSE","SIMULATION","Synthetic customer did not respond.",{action});continue;} audit(c,day,"CUSTOMER_RESPONSE_RECEIVED","SIMULATION","Synthetic customer responded.",{action});
    const outcome=keyedUnit(config.seed,c.id,day,action,c.contactAttempts,"outcome"); if(outcome<h.disputePropensity){transition(c,"DISPUTED");audit(c,day,"DISPUTE_DETECTED","SIMULATION","Synthetic customer disputed the invoice.");continue;} const payChance=h.paymentAbility*h.willingness*(action==="SEND_PAYMENT_LINK"?1.15:1); if(outcome<payChance*.38){const partial=keyedUnit(config.seed,c.id,day,"partial")<h.partialTendency;applyPayment(c,{eventId:stableId("sim-event",config.seed,c.id,day,"immediate",c.contactAttempts),paymentId:stableId("sim-payment",config.seed,c.id,day,"immediate",c.contactAttempts),caseId:c.id,amountPaise:partial?Math.max(1,Math.floor(c.outstandingPaise*.35)):c.outstandingPaise,simulationDay:day,source:"SIMULATION",reason:"Synthetic immediate response payment."});} else if(action==="REQUEST_PAYMENT_COMMITMENT"||action==="FOLLOW_UP_PROMISE"||outcome<payChance*.7){const amount=keyedUnit(config.seed,c.id,day,"promise-amount")<h.partialTendency?Math.max(1,Math.floor(c.outstandingPaise*.5)):c.outstandingPaise;const promise={id:stableId("sim-promise",config.seed,c.id,day,c.promises.length),createdDay:day,amountPaise:amount,dueDay:day+keyedInt(config.seed,2,7,c.id,day,"promise-due"),status:"ACTIVE" as const,amountFulfilledPaise:0,paymentIds:[]};c.promises.push(promise);transition(c,"PROMISED");audit(c,day,"PROMISE_CREATED","SIMULATION","Synthetic customer made a dated promise.",{amountPaise:amount,metadata:{promiseId:promise.id,dueDay:promise.dueDay}});}
  }
  for(const c of cases){if(c.outstandingPaise<0||c.recoveredPaise+c.outstandingPaise!==c.originalAmountPaise)throw new Error(`Monetary invariant failed for ${c.id}`);}
  return {runId,config,initialPortfolio,hiddenState:generated.hidden,finalCases:cases,auditEvents:events,payments,metrics:calculateMetrics(initialPortfolio,cases,events)};
}

export function calculateMetrics(initial:SimulationCase[],finalCases:SimulationCase[],events:AuditEvent[]):SimulationMetrics {
  const starting=initial.reduce((s,c)=>s+c.startingOutstandingPaise,0), ending=finalCases.reduce((s,c)=>s+c.outstandingPaise,0), recovered=starting-ending; const full=finalCases.filter(c=>c.outstandingPaise===0), partial=finalCases.filter(c=>c.recoveredPaise>c.initialRecoveredPaise&&c.outstandingPaise>0); const count=(type:string)=>events.filter(e=>e.type===type).length; const action=(a:RecoveryAction)=>events.filter(e=>e.type==="ACTION_EXECUTED"&&e.action===a).length; const contacts=events.filter(e=>e.type==="CUSTOMER_CONTACTED").length; const promises=finalCases.flatMap(c=>c.promises); const recoveryDays=full.map(c=>c.recoveredDay).filter((x):x is number=>x!==null);
  return {portfolio:{totalCases:finalCases.length,totalOriginalInvoicePaise:initial.reduce((s,c)=>s+c.originalAmountPaise,0),totalStartingOutstandingPaise:starting},recovery:{totalRecoveredPaise:recovered,recoveryRate:starting?recovered/starting:0,fullyRecoveredCases:full.length,partiallyRecoveredCases:partial.length,unresolvedCases:finalCases.filter(c=>c.outstandingPaise>0&&!c.dispute&&!c.escalated&&!c.closed).length,disputedCases:finalCases.filter(c=>c.dispute).length,escalatedCases:finalCases.filter(c=>c.escalated).length,averageDaysToFullRecovery:recoveryDays.length?recoveryDays.reduce((a,b)=>a+b,0)/recoveryDays.length:0},interventions:{gentleReminders:action("SEND_GENTLE_REMINDER"),paymentReminders:action("SEND_PAYMENT_REMINDER"),paymentLinks:action("SEND_PAYMENT_LINK"),commitmentRequests:action("REQUEST_PAYMENT_COMMITMENT"),promiseFollowUps:action("FOLLOW_UP_PROMISE"),waits:action("WAIT"),escalations:action("ESCALATE_TO_HUMAN"),customerContacts:contacts},promises:{created:promises.length,fulfilled:promises.filter(p=>p.status==="FULFILLED").length,partiallyFulfilled:promises.filter(p=>p.status==="PARTIALLY_FULFILLED").length,broken:promises.filter(p=>p.status==="BROKEN").length,fulfillmentRate:promises.length?promises.filter(p=>p.status==="FULFILLED").length/promises.length:0},safety:{policyBlocks:count("ACTION_BLOCKED"),cooldownBlocks:events.filter(e=>e.metadata?.rule==="COOLDOWN").length,communicationLimitBlocks:events.filter(e=>e.metadata?.rule==="CONTACT_LIMIT").length,promiseProtectionBlocks:events.filter(e=>e.metadata?.rule==="PROMISE_PROTECTION").length,disputeStops:events.filter(e=>e.metadata?.rule==="DISPUTE_STOP").length,terminalStops:events.filter(e=>e.metadata?.rule==="TERMINAL_STOP").length,highValueEscalations:events.filter(e=>e.metadata?.rule==="HIGH_VALUE").length},efficiency:{interventionsPerFullRecovery:full.length?contacts/full.length:0,recoveredPaisePerContact:contacts?recovered/contacts:0,averageDaysToRecovery:recoveryDays.length?recoveryDays.reduce((a,b)=>a+b,0)/recoveryDays.length:0},reconciliation:{endingOutstandingPaise:ending,expectedEndingOutstandingPaise:starting-recovered,valid:ending===starting-recovered&&recovered<=starting}};
}

export function formatTimeline(result:SimulationResult,caseId:string):string { const c=result.finalCases.find(x=>x.id===caseId);if(!c)return `Case ${caseId} not found.`;return [`# Synthetic timeline: ${caseId}`,`Final state: ${c.state}; outstanding: ${c.outstandingPaise} paise`,...result.auditEvents.filter(e=>e.caseId===caseId).map(e=>`- Day ${e.simulationDay}: **${e.type}** — ${e.reason}${e.amountPaise!==undefined?` (${e.amountPaise} paise)`:""}`)].join("\n"); }
