-- System administrator flag: sits above tenants and is the only credential that
-- may create an `admin` or promote a user to `admin`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_system_admin" BOOLEAN NOT NULL DEFAULT false;

-- Promote exactly one real administrator (the oldest active non-demo admin), and
-- only while no real system administrator exists, so a deliberate demotion is never
-- undone by a later run. Demo accounts never qualify: they are read-only (the demo
-- session guard refuses their writes) and share a public password, so a demo system
-- administrator would lock every real admin out of creating or promoting admins.
-- A demo account never holds the flag (it is ignored at runtime either way).
UPDATE "users" SET "is_system_admin" = false
WHERE "is_system_admin" = true
  AND (COALESCE("is_demo", false) = true OR lower(COALESCE("email", '')) LIKE '%@agridemo.com');

UPDATE "users" SET "is_system_admin" = true
WHERE "id" = (
    SELECT "id" FROM "users"
    WHERE "role" = 'admin'
      AND COALESCE("is_demo", false) = false
      AND lower(COALESCE("email", '')) NOT LIKE '%@agridemo.com'
      AND COALESCE("is_active", true) = true
    ORDER BY "created_at" ASC NULLS LAST, "id" ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE "is_system_admin" = true AND COALESCE("is_demo", false) = false
);
