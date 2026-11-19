-- Diagnosis events fed outbreak clusters only: they had no author, so nobody
-- could read back what they had concluded. Record the account that performed
-- the diagnosis and index it for the per-user history read.
ALTER TABLE "diagnosis_events" ADD COLUMN IF NOT EXISTS "user_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagnosis_events_user_id_fkey') THEN
        ALTER TABLE "diagnosis_events"
            ADD CONSTRAINT "diagnosis_events_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "diagnosis_events_user_id_created_at_idx"
    ON "diagnosis_events"("user_id", "created_at");
