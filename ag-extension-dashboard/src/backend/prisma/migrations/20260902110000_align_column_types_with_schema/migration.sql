-- Align four hand-written column types with schema.prisma (another
-- db-push-drift artifact): migration SQL used TIMESTAMPTZ / VARCHAR(n)[]
-- where the schema declares TIMESTAMP(6) / TEXT[]. Guarded + idempotent.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'farmer_assignment_history' AND column_name = 'assigned_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "farmer_assignment_history" ALTER COLUMN "assigned_at" SET DATA TYPE TIMESTAMP(6);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_feedback' AND column_name = 'created_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "sms_feedback" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(6);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'created_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "whatsapp_messages" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(6);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'updated_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE "whatsapp_messages" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(6);
  END IF;
END $$;

-- Widen advisory_preferences array element types VARCHAR(n)[] -> TEXT[] and
-- re-pin the defaults so they match the schema (String[] with defaults).
ALTER TABLE "advisory_preferences" ALTER COLUMN "channels" SET DATA TYPE TEXT[];
ALTER TABLE "advisory_preferences" ALTER COLUMN "channels" SET DEFAULT ARRAY['whatsapp']::TEXT[];
ALTER TABLE "advisory_preferences" ALTER COLUMN "categories" SET DATA TYPE TEXT[];
ALTER TABLE "advisory_preferences" ALTER COLUMN "categories" SET DEFAULT ARRAY['planting_window', 'dry_spell_warning', 'faw_degree_day', 'late_blight_risk']::TEXT[];
