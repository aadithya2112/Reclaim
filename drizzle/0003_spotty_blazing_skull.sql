ALTER TABLE "ai_decision_runs" ADD COLUMN "privacy_mode" text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_operational_history_change() RETURNS trigger AS $$
BEGIN
  IF current_setting('recoup.demo_reset', true) = 'enabled'
     AND OLD.recovery_case_id IN ('rc_m1_inv_001', 'rc_m1_inv_002', 'rc_m7_inv_003') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
