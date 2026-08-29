-- Close relationship gaps found in the schema audit: FK columns that existed
-- without a foreign key or Prisma relation. All statements are idempotent and
-- null out orphaned references before adding the constraint so migration never
-- fails on legacy rows pointing at deleted users/farmers.

-- 1. sms_history -> users (sender) and farmers (farmer).
CREATE INDEX IF NOT EXISTS "sms_history_sender_id_idx" ON "sms_history"("sender_id");
CREATE INDEX IF NOT EXISTS "sms_history_farmer_id_idx" ON "sms_history"("farmer_id");

UPDATE "sms_history" SET "sender_id" = NULL
 WHERE "sender_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "sms_history"."sender_id");
UPDATE "sms_history" SET "farmer_id" = NULL
 WHERE "farmer_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "farmers" WHERE "farmers"."id" = "sms_history"."farmer_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_history_sender_id_fkey') THEN
        ALTER TABLE "sms_history" ADD CONSTRAINT "sms_history_sender_id_fkey"
            FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_history_farmer_id_fkey') THEN
        ALTER TABLE "sms_history" ADD CONSTRAINT "sms_history_farmer_id_fkey"
            FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 2. outreach_messages -> farmers.
CREATE INDEX IF NOT EXISTS "outreach_messages_farmer_id_idx" ON "outreach_messages"("farmer_id");

UPDATE "outreach_messages" SET "farmer_id" = NULL
 WHERE "farmer_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "farmers" WHERE "farmers"."id" = "outreach_messages"."farmer_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_messages_farmer_id_fkey') THEN
        ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_farmer_id_fkey"
            FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 3. webrtc_rooms -> users (host). Rooms are ephemeral; orphan hosts are dropped.
DELETE FROM "webrtc_rooms" r
 WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = r."host_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webrtc_rooms_host_id_fkey') THEN
        ALTER TABLE "webrtc_rooms" ADD CONSTRAINT "webrtc_rooms_host_id_fkey"
            FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- 4. transaction_submissions -> users (verifier).
CREATE INDEX IF NOT EXISTS "transaction_submissions_verified_by_idx" ON "transaction_submissions"("verified_by");

UPDATE "transaction_submissions" SET "verified_by" = NULL
 WHERE "verified_by" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "transaction_submissions"."verified_by");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_submissions_verified_by_fkey') THEN
        ALTER TABLE "transaction_submissions" ADD CONSTRAINT "transaction_submissions_verified_by_fkey"
            FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 5. shares -> users (creator).
CREATE INDEX IF NOT EXISTS "shares_created_by_idx" ON "shares"("created_by");

UPDATE "shares" SET "created_by" = NULL
 WHERE "created_by" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "shares"."created_by");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shares_created_by_fkey') THEN
        ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_fkey"
            FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 6. upload_records -> users (owner) and farmers. The raw-SQL bootstrap
--    already defines these FKs; this keeps the Prisma-managed path in sync.
UPDATE "upload_records" SET "farmer_id" = NULL
 WHERE "farmer_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "farmers" WHERE "farmers"."id" = "upload_records"."farmer_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'upload_records_owner_user_id_fkey') THEN
        ALTER TABLE "upload_records" ADD CONSTRAINT "upload_records_owner_user_id_fkey"
            FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'upload_records_farmer_id_fkey') THEN
        ALTER TABLE "upload_records" ADD CONSTRAINT "upload_records_farmer_id_fkey"
            FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 7. soil_lab_results -> fields.
CREATE INDEX IF NOT EXISTS "soil_lab_results_field_id_idx" ON "soil_lab_results"("field_id");

UPDATE "soil_lab_results" SET "field_id" = NULL
 WHERE "field_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "fields" WHERE "fields"."id" = "soil_lab_results"."field_id");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'soil_lab_results_field_id_fkey') THEN
        ALTER TABLE "soil_lab_results" ADD CONSTRAINT "soil_lab_results_field_id_fkey"
            FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 8. data_export_requests -> tenants, farmers, users. Raw bootstrap has the
--    farmer/requester FKs; tenant FK was previously unmodeled.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_export_requests_tenant_id_fkey') THEN
        ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_export_requests_farmer_id_fkey') THEN
        ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_farmer_id_fkey"
            FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_export_requests_requested_by_fkey') THEN
        ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_requested_by_fkey"
            FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;

-- 9. data_consents -> users (recorder). Raw bootstrap has the FK; Prisma now models it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_consents_recorded_by_fkey') THEN
        ALTER TABLE "data_consents" ADD CONSTRAINT "data_consents_recorded_by_fkey"
            FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT;
    END IF;
END $$;
