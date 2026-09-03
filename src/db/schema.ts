import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const recoveryCaseStatus = pgEnum("recovery_case_status", [
  "OPEN",
  "PARTIALLY_PAID",
  "RECOVERED",
]);

export const operationalQueueStatus = pgEnum("operational_queue_status", [
  "ACT_NOW",
  "WAIT_PROTECTED",
  "DEFERRED_CAPACITY",
  "CLOSED",
]);

export const decisionRunStatus = pgEnum("decision_run_status", [
  "LIVE_SUCCESS",
  "CACHED_REPLAY",
  "MANUAL_REVIEW",
]);

export const proposalSource = pgEnum("proposal_source", [
  "MODEL",
  "CACHED_MODEL",
  "REVIEWER_OVERRIDE",
]);

export const policyOutcome = pgEnum("policy_outcome", [
  "AUTO_ELIGIBLE",
  "APPROVAL_REQUIRED",
  "BLOCKED",
]);

export const approvalDecision = pgEnum("approval_decision", [
  "APPROVED",
  "REJECTED",
]);

export const promiseStatus = pgEnum("promise_status", [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "FULFILLED",
  "BROKEN",
  "CANCELLED",
]);

export const recoveryCases = pgTable(
  "recovery_cases",
  {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull().default("INR"),
    amountDue: bigint("amount_due", { mode: "number" }).notNull(),
    amountRecovered: bigint("amount_recovered", { mode: "number" })
      .notNull()
      .default(0),
    status: recoveryCaseStatus("status").notNull().default("OPEN"),
    operationalQueueStatus: operationalQueueStatus("operational_queue_status")
      .notNull()
      .default("ACT_NOW"),
    queuePriority: integer("queue_priority").notNull().default(0),
    approvedProposalId: text("approved_proposal_id"),
    razorpayPaymentLinkId: text("razorpay_payment_link_id"),
    razorpayPaymentLinkUrl: text("razorpay_payment_link_url"),
    razorpayPaymentLinkReferenceId: text("razorpay_payment_link_reference_id"),
    razorpayPaymentLinkAmount: bigint("razorpay_payment_link_amount", {
      mode: "number",
    }),
    paymentLinkStartingRecovered: bigint(
      "payment_link_starting_recovered",
      { mode: "number" },
    ),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recovery_cases_invoice_number_unique").on(
      table.invoiceNumber,
    ),
    uniqueIndex("recovery_cases_payment_link_id_unique").on(
      table.razorpayPaymentLinkId,
    ),
  ],
);

export const customerMessages = pgTable(
  "customer_messages",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    bodyHash: text("body_hash").notNull(),
    businessTimezone: text("business_timezone").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("customer_messages_case_index").on(table.recoveryCaseId)],
);

export const aiDecisionRuns = pgTable(
  "ai_decision_runs",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    customerMessageId: text("customer_message_id")
      .notNull()
      .references(() => customerMessages.id, { onDelete: "restrict" }),
    status: decisionRunStatus("status").notNull(),
    canonicalInputHash: text("canonical_input_hash").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    providerPolicyVersion: text("provider_policy_version").notNull(),
    modelId: text("model_id").notNull(),
    providerName: text("provider_name"),
    privacyMode: text("privacy_mode"),
    outputHash: text("output_hash"),
    validatedOutput: jsonb("validated_output"),
    failureCode: text("failure_code"),
    failureDetail: text("failure_detail"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_decision_runs_case_index").on(table.recoveryCaseId),
    index("ai_decision_runs_input_hash_index").on(table.canonicalInputHash),
  ],
);

export const recoveryProposals = pgTable(
  "recovery_proposals",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    customerMessageId: text("customer_message_id")
      .notNull()
      .references(() => customerMessages.id, { onDelete: "restrict" }),
    decisionRunId: text("decision_run_id").references(() => aiDecisionRuns.id, {
      onDelete: "restrict",
    }),
    parentProposalId: text("parent_proposal_id"),
    revision: integer("revision").notNull(),
    source: proposalSource("source").notNull(),
    proposalHash: text("proposal_hash").notNull(),
    proposal: jsonb("proposal").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recovery_proposals_case_revision_unique").on(
      table.recoveryCaseId,
      table.revision,
    ),
    index("recovery_proposals_run_index").on(table.decisionRunId),
  ],
);

export const policyEvaluations = pgTable(
  "policy_evaluations",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => recoveryProposals.id, { onDelete: "restrict" }),
    policyVersion: text("policy_version").notNull(),
    outcome: policyOutcome("outcome").notNull(),
    reasons: jsonb("reasons").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("policy_evaluations_proposal_index").on(table.proposalId)],
);

export const humanApprovals = pgTable(
  "human_approvals",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => recoveryProposals.id, { onDelete: "restrict" }),
    decision: approvalDecision("decision").notNull(),
    reviewer: text("reviewer").notNull(),
    note: text("note"),
    overrideProposalId: text("override_proposal_id").references(
      () => recoveryProposals.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("human_approvals_proposal_unique").on(table.proposalId),
    index("human_approvals_case_index").on(table.recoveryCaseId),
  ],
);

export const promises = pgTable(
  "promises",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => recoveryProposals.id, { onDelete: "restrict" }),
    activationRazorpayEventId: text("activation_razorpay_event_id"),
    amountMode: text("amount_mode").notNull(),
    promisedDate: date("promised_date").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }),
    status: promiseStatus("status").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("promises_proposal_unique").on(table.proposalId),
    index("promises_case_index").on(table.recoveryCaseId),
  ],
);

export const operationalAuditEvents = pgTable(
  "operational_audit_events",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    id: text("id").notNull().unique(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    actor: text("actor").notNull(),
    eventType: text("event_type").notNull(),
    detail: text("detail").notNull(),
    evidenceLabel: text("evidence_label").notNull(),
    payloadHash: text("payload_hash").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("operational_audit_case_sequence_index").on(
      table.recoveryCaseId,
      table.sequence,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    razorpayPaymentId: text("razorpay_payment_id").notNull(),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentLinkId: text("razorpay_payment_link_id").notNull(),
    razorpayEventId: text("razorpay_event_id").notNull(),
    razorpayEventType: text("razorpay_event_type"),
    paymentLinkAmountPaid: bigint("payment_link_amount_paid", {
      mode: "number",
    }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    method: text("method").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_razorpay_payment_id_unique").on(
      table.razorpayPaymentId,
    ),
    uniqueIndex("payments_razorpay_event_id_unique").on(
      table.razorpayEventId,
    ),
    index("payments_recovery_case_id_index").on(table.recoveryCaseId),
  ],
);
