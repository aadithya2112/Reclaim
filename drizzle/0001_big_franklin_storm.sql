ALTER TYPE "public"."recovery_case_status" ADD VALUE 'PARTIALLY_PAID' BEFORE 'RECOVERED';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_event_type" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_link_amount_paid" bigint;--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "razorpay_payment_link_reference_id" text;--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "razorpay_payment_link_amount" bigint;--> statement-breakpoint
ALTER TABLE "recovery_cases" ADD COLUMN "payment_link_starting_recovered" bigint;