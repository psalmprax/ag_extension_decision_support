-- System administrator flag: sits above tenants and is the only credential that
-- may create an `admin` or promote a user to `admin`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_system_admin" BOOLEAN NOT NULL DEFAULT false;

-- A demo account never holds the flag (it is ignored at runtime either way): demo
-- accounts are read-only and share a published password.
UPDATE "users" SET "is_system_admin" = false
WHERE "is_system_admin" = true AND COALESCE("is_demo", false) = true;

-- Who holds the flag is decided by the seed (prisma/systemAdministrator.cjs), not
-- here: the owner designated admin@agridemo.com, and it is enabled only once its
-- password is private (SYSTEM_ADMIN_INITIAL_PASSWORD), never with the public default.
