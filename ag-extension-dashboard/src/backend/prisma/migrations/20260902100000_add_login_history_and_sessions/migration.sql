-- Catch-up migration for tables/columns that existed only in the Prisma
-- schema (the dev flow used `prisma db push`, which bypasses migration SQL):
--   * login_history, user_sessions
--   * users MFA / lockout / last_login columns
-- These were referenced by running code (sessionService, loginHistoryService,
-- auth routes) but never created by `migrate deploy` on fresh databases.
-- Idempotent — safe to re-run.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_backup_codes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockout_until" TIMESTAMP(6);

CREATE TABLE IF NOT EXISTS "login_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "failure_reason" VARCHAR(100),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "device" VARCHAR(100),
    "location" VARCHAR(150),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "login_history_user_id_created_at_idx" ON "login_history"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_history_email_created_at_idx" ON "login_history"("email", "created_at");
CREATE INDEX IF NOT EXISTS "login_history_status_idx" ON "login_history"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='login_history_user_id_fkey') THEN
    ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "device" VARCHAR(100),
    "location" VARCHAR(150),
    "last_active_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_is_revoked_idx" ON "user_sessions"("user_id", "is_revoked");
CREATE INDEX IF NOT EXISTS "user_sessions_token_hash_idx" ON "user_sessions"("token_hash");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_sessions_user_id_fkey') THEN
    ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
