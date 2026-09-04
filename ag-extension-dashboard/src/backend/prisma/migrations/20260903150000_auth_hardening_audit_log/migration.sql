-- Email verification + TOTP replay guard on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_totp_step" BIGINT;

-- Accounts that predate verification are grandfathered so nobody is locked out by the deploy.
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;

-- Immutable audit trail for privileged mutations
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"      UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_role"    VARCHAR(50),
  "action"        VARCHAR(120) NOT NULL,
  "method"        VARCHAR(10)  NOT NULL,
  "path"          VARCHAR(512) NOT NULL,
  "resource_type" VARCHAR(80),
  "resource_id"   VARCHAR(120),
  "status_code"   INTEGER NOT NULL,
  "ip_address"    VARCHAR(64),
  "user_agent"    VARCHAR(512),
  "request_body"  JSONB,
  "created_at"    TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
