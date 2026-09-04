-- Add FK constraints that schema.prisma declares but no prior migration
-- created (another artifact of dev-only `prisma db push` usage). Columns are
-- nullable uuids, so ON DELETE SET NULL is a no-op for legacy orphan-free data.
-- Idempotent — safe to re-run.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='visits_tenant_id_fkey') THEN
    ALTER TABLE "visits" ADD CONSTRAINT "visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_conversations_tenant_id_fkey') THEN
    ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reports_tenant_id_fkey') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='alerts_tenant_id_fkey') THEN
    ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_tenant_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_farmer_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='recommendation_outcomes_officer_id_fkey') THEN
    ALTER TABLE "recommendation_outcomes" ADD CONSTRAINT "recommendation_outcomes_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Correct ON DELETE actions hand-written migrations got wrong relative to
-- schema.prisma (drop + re-add with the schema-declared behavior).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'advisory_preferences_farmer_id_fkey' AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE "advisory_preferences" DROP CONSTRAINT "advisory_preferences_farmer_id_fkey";
    ALTER TABLE "advisory_preferences" ADD CONSTRAINT "advisory_preferences_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'farmer_assignment_history_reassigned_by_fkey' AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE "farmer_assignment_history" DROP CONSTRAINT "farmer_assignment_history_reassigned_by_fkey";
    ALTER TABLE "farmer_assignment_history" ADD CONSTRAINT "farmer_assignment_history_reassigned_by_fkey" FOREIGN KEY ("reassigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recommendation_reviews_reviewed_by_fkey' AND confdeltype <> 'n'
  ) THEN
    ALTER TABLE "recommendation_reviews" DROP CONSTRAINT "recommendation_reviews_reviewed_by_fkey";
    ALTER TABLE "recommendation_reviews" ADD CONSTRAINT "recommendation_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop an FK that migrations hand-wrote but schema.prisma does NOT declare
-- (UploadRecord.tenantId has no @relation in the schema). Schema is the
-- source of truth for referential integrity.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='upload_records_tenant_id_fkey') THEN
    ALTER TABLE "upload_records" DROP CONSTRAINT "upload_records_tenant_id_fkey";
  END IF;
END $$;
