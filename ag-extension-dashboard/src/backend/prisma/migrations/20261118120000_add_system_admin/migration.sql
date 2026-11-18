-- System administrator flag: sits above tenants and is the only credential that
-- may create an `admin` or promote a user to `admin`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_system_admin" BOOLEAN NOT NULL DEFAULT false;

-- Promote exactly one administrator (the oldest, which is the seeded System
-- Administrator) and only while no system administrator exists, so a deliberate
-- demotion is never undone by a later run.
UPDATE "users" SET "is_system_admin" = true
WHERE "id" = (
    SELECT "id" FROM "users"
    WHERE "role" = 'admin'
    ORDER BY "created_at" ASC NULLS LAST, "id" ASC
    LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "users" WHERE "is_system_admin" = true);
