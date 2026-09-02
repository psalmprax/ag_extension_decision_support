-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant_id backfill on tenant-agnostic tables + relationship-gap closures.
-- All statements idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add tenant_id columns (nullable, backfilled below, indexed).
ALTER TABLE "visits"             ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "alerts"             ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "notifications"      ADD COLUMN IF NOT EXISTS "tenant_id" UUID;
ALTER TABLE "reports"            ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

-- 2. Add notification.farmer_id so phone-only farmers can be targeted.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "farmer_id" UUID;

-- 3. Backfill tenant_id from the owning farmer (or user) where derivable.
UPDATE "visits" v
   SET "tenant_id" = f."tenant_id"
  FROM "farmers" f
 WHERE v."farmer_id" = f."id" AND f."tenant_id" IS NOT NULL;

UPDATE "chat_conversations" cc
   SET "tenant_id" = f."tenant_id"
  FROM "farmers" f
 WHERE cc."farmer_id" = f."id" AND f."tenant_id" IS NOT NULL;

UPDATE "notifications" n
   SET "tenant_id" = u."tenant_id",
       "farmer_id" = (SELECT f."id" FROM "farmers" f WHERE f."user_id" = n."user_id" ORDER BY f."created_at" LIMIT 1)
  FROM "users" u
 WHERE n."user_id" = u."id" AND u."tenant_id" IS NOT NULL;

UPDATE "reports" r
   SET "tenant_id" = u."tenant_id"
  FROM "users" u
 WHERE r."generated_by" = u."id" AND u."tenant_id" IS NOT NULL;

-- Alerts have no owner user; backfill from the first affected farmer's tenant.
UPDATE "alerts" a
   SET "tenant_id" = sub."tenant_id"
  FROM (
    SELECT unm.id AS alert_id, f."tenant_id"
      FROM "alerts" unm
     CROSS JOIN LATERAL unnest(unm."affected_farmers") AS uf(fid)
     JOIN "farmers" f ON f."id" = uf.fid
     WHERE f."tenant_id" IS NOT NULL
  ) sub
 WHERE a."id" = sub.alert_id;

-- 4. Indexes for the new tenant scoping.
CREATE INDEX IF NOT EXISTS "visits_tenant_id_idx"             ON "visits"("tenant_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_tenant_id_idx" ON "chat_conversations"("tenant_id");
CREATE INDEX IF NOT EXISTS "alerts_tenant_id_idx"             ON "alerts"("tenant_id");
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_idx"      ON "notifications"("tenant_id");
CREATE INDEX IF NOT EXISTS "notifications_farmer_id_idx"      ON "notifications"("farmer_id");
CREATE INDEX IF NOT EXISTS "reports_tenant_id_idx"            ON "reports"("tenant_id");

-- 5. Relationship-gap closures.
-- a) VideoConsultation ↔ WebRTCRoom (1:1 by room_id).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_consultations_room_id_key') THEN
        ALTER TABLE "video_consultations" ADD CONSTRAINT "video_consultations_room_id_key"
            UNIQUE ("room_id");
    END IF;
END $$;

-- b) Farmer assignment audit history.
CREATE TABLE IF NOT EXISTS "farmer_assignment_history" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "farmer_id"     UUID NOT NULL REFERENCES "farmers"("id") ON DELETE CASCADE,
    "officer_id"    UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "reassigned_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
    "reason"        TEXT,
    "assigned_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "farmer_assignment_history_farmer_idx" ON "farmer_assignment_history"("farmer_id");
CREATE INDEX IF NOT EXISTS "farmer_assignment_history_officer_idx" ON "farmer_assignment_history"("officer_id");

-- c) Backfill assignment history with current assignments (marked by the
--    assigning officer when determinable, else by the farmer owner).
INSERT INTO "farmer_assignment_history" ("farmer_id", "officer_id", "reassigned_by", "reason", "assigned_at")
SELECT f."id", f."assigned_officer_id",
       COALESCE(f."user_id", f."assigned_officer_id"),
       'backfill_current_assignment',
       COALESCE(f."updated_at", NOW())
  FROM "farmers" f
 WHERE f."assigned_officer_id" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "farmer_assignment_history" h
     WHERE h."farmer_id" = f."id" AND h."officer_id" = f."assigned_officer_id"
   );