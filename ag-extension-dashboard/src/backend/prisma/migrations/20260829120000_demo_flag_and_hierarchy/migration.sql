-- Add is_demo origin flag to distinguish demo/seed records from real production data.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "farmers" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing demo/seed records:
--   * reserved legacy seed IDs
--   * any @agridemo.com login (demo officer, admin, regional managers)
--   * the canonical demo farmer dataset (d1... UUIDs)
UPDATE "users" SET "is_demo" = true WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE "users" SET "is_demo" = true WHERE lower("email") LIKE '%@agridemo.com';
UPDATE "farmers" SET "is_demo" = true WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE "farmers" SET "is_demo" = true
  WHERE id::text LIKE 'd1000000-0000-0000-0000-0000000000%'
     OR id::text LIKE 'd1%';

-- Manager self-reference for the people/region hierarchy (regional manager -> officers).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" UUID;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_id_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey"
            FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "users_manager_id_idx" ON "users"("manager_id");