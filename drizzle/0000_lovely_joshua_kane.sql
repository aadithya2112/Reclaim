CREATE TYPE "public"."recovery_case_status" AS ENUM('OPEN', 'RECOVERED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"recovery_case_id" text NOT NULL,
	"razorpay_payment_id" text NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_link_id" text NOT NULL,
	"razorpay_event_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"due_date" date NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"amount_due" bigint NOT NULL,
	"amount_recovered" bigint DEFAULT 0 NOT NULL,
	"status" "recovery_case_status" DEFAULT 'OPEN' NOT NULL,
	"razorpay_payment_link_id" text,
	"razorpay_payment_link_url" text,
	"recovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recovery_case_id_recovery_cases_id_fk" FOREIGN KEY ("recovery_case_id") REFERENCES "public"."recovery_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_payment_id_unique" ON "payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_event_id_unique" ON "payments" USING btree ("razorpay_event_id");--> statement-breakpoint
CREATE INDEX "payments_recovery_case_id_index" ON "payments" USING btree ("recovery_case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_cases_invoice_number_unique" ON "recovery_cases" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "recovery_cases_payment_link_id_unique" ON "recovery_cases" USING btree ("razorpay_payment_link_id");