-- Time zones for people and organisations (IANA names, e.g. Africa/Nairobi). Null means
-- "use the country's main time zone"; dates typed by SMS and working hours use it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "time_zone" VARCHAR(64);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "time_zone" VARCHAR(64);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "country" VARCHAR(100);
