CREATE TYPE "public"."approval_decision" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."decision_run_status" AS ENUM('LIVE_SUCCESS', 'CACHED_REPLAY', 'MANUAL_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."operational_queue_status" AS ENUM('ACT_NOW', 'WAIT_PROTECTED', 'DEFERRED_CAPACITY', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."policy_outcome" AS ENUM('AUTO_ELIGIBLE', 'APPROVAL_REQUIRED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."promise_status" AS ENUM('PENDING_VERIFICATION', 'ACTIVE', 'FULFILLED', 'BROKEN', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."proposal_source" AS ENUM('MODEL', 'CACHED_MODEL', 'REVIEWER_OVERRIDE');--> statement-breakpoint
CREATE TABLE "ai_decision_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"customer_message_id" text NOT NULL,
	"status" "decision_run_status" NOT NULL,
	"canonical_input_hash" text NOT NULL,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"provider_policy_version" text NOT NULL,
	"model_id" text NOT NULL,
	"provider_name" text,
	"output_hash" text,
	"validated_output" jsonb,
	"failure_code" text,
	"failure_detail" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"body" text NOT NULL,
	"body_hash" text NOT NULL,
	"business_timezone" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"reviewer" text NOT NULL,
	"note" text,
	"override_proposal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_audit_events" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"recovery_case_id" text NOT NULL,
	"actor" text NOT NULL,
	"event_type" text NOT NULL,
	"detail" text NOT NULL,
	"evidence_label" text NOT NULL,
	"payload_hash" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_audit_events_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "policy_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"outcome" "policy_outcome" NOT NULL,
	"reasons" jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promises" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"activation_razorpay_event_id" text,
	"amount_mode" text NOT NULL,
	"promised_date" date NOT NULL,
	"amount_paise" bigint,
	"status" "promise_status" NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"customer_message_id" text NOT NULL,
	"decision_run_id" text,
	"parent_proposal_id" text,
	"revision" integer NOT NULL,
	"source" "proposal_source" NOT NULL,
	"proposal_hash" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "operational_queue_status" "operational_queue_status" DEFAULT 'ACT_NOW' NOT NULL;--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "queue_priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "approved_proposal_id" text;--> statement-breakpoint
ALTER TABLE "ai_decision_runs" ADD CONSTRAINT "ai_decision_runs_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decision_runs" ADD CONSTRAINT "ai_decision_runs_customer_message_id_customer_messages_id_fk" FOREIGN KEY ("customer_message_id") REFERENCES "public"."customer_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_proposal_id_recovery_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_approvals" ADD CONSTRAINT "human_approvals_override_proposal_id_recovery_proposals_id_fk" FOREIGN KEY ("override_proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_audit_events" ADD CONSTRAINT "operational_audit_events_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_evaluations" ADD CONSTRAINT "policy_evaluations_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_evaluations" ADD CONSTRAINT "policy_evaluations_proposal_id_recovery_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises" ADD CONSTRAINT "promises_proposal_id_recovery_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_proposals" ADD CONSTRAINT "recovery_proposals_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_proposals" ADD CONSTRAINT "recovery_proposals_customer_message_id_customer_messages_id_fk" FOREIGN KEY ("customer_message_id") REFERENCES "public"."customer_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_proposals" ADD CONSTRAINT "recovery_proposals_decision_run_id_ai_decision_runs_id_fk" FOREIGN KEY ("decision_run_id") REFERENCES "public"."ai_decision_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_decision_runs_case_index" ON "ai_decision_runs" USING btree ("recovery_case_id");--> statement-breakpoint
CREATE INDEX "ai_decision_runs_input_hash_index" ON "ai_decision_runs" USING btree ("canonical_input_hash");--> statement-breakpoint
CREATE INDEX "customer_messages_case_index" ON "customer_messages" USING btree ("recovery_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "human_approvals_proposal_unique" ON "human_approvals" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "human_approvals_case_index" ON "human_approvals" USING btree ("recovery_case_id");--> statement-breakpoint
CREATE INDEX "operational_audit_case_sequence_index" ON "operational_audit_events" USING btree ("recovery_case_id","sequence");--> statement-breakpoint
CREATE INDEX "policy_evaluations_proposal_index" ON "policy_evaluations" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promises_proposal_unique" ON "promises" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "promises_case_index" ON "promises" USING btree ("recovery_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_proposals_case_revision_unique" ON "recovery_proposals" USING btree ("recovery_case_id","revision");--> statement-breakpoint
CREATE INDEX "recovery_proposals_run_index" ON "recovery_proposals" USING btree ("decision_run_id");
--> statement-breakpoint
ALTER TABLE "recovery_proposals" ADD CONSTRAINT "recovery_proposals_parent_proposal_id_fk" FOREIGN KEY ("parent_proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD CONSTRAINT "recovery_cases_approved_proposal_id_fk" FOREIGN KEY ("approved_proposal_id") REFERENCES "public"."recovery_proposals"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "promises_activation_event_unique" ON "promises" USING btree ("activation_razorpay_event_id") WHERE "activation_razorpay_event_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "recovery_cases" SET "operational_queue_status" = 'ACT_NOW', "queue_priority" = 100 WHERE "invoice_number" = 'INV-003';
--> statement-breakpoint
UPDATE "recovery_cases" SET "operational_queue_status" = 'DEFERRED_CAPACITY', "queue_priority" = CASE WHEN "invoice_number" = 'INV-001' THEN 80 ELSE 70 END WHERE "invoice_number" IN ('INV-001', 'INV-002');
--> statement-breakpoint
CREATE FUNCTION prevent_operational_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER recovery_proposals_immutable BEFORE UPDATE OR DELETE ON "recovery_proposals" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
--> statement-breakpoint
CREATE TRIGGER operational_audit_events_append_only BEFORE UPDATE OR DELETE ON "operational_audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
--> statement-breakpoint
CREATE TRIGGER customer_messages_immutable BEFORE UPDATE OR DELETE ON "customer_messages" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
--> statement-breakpoint
CREATE TRIGGER ai_decision_runs_immutable BEFORE UPDATE OR DELETE ON "ai_decision_runs" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
--> statement-breakpoint
CREATE TRIGGER policy_evaluations_immutable BEFORE UPDATE OR DELETE ON "policy_evaluations" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
--> statement-breakpoint
CREATE TRIGGER human_approvals_immutable BEFORE UPDATE OR DELETE ON "human_approvals" FOR EACH ROW EXECUTE FUNCTION prevent_operational_history_change();
