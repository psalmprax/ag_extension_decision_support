-- Persist durable operation state that was previously held in process memory:
--   1. pending_paypal_payments  — PayPal checkout intents awaiting browser redirect back
--   2. offline_queue_items      — extension offline sync queue + dead-letter entries
--   3. activity_claims          — officer claims on triage activities
-- Idempotent — safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pending_paypal_payments
CREATE TABLE IF NOT EXISTS "pending_paypal_payments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "payment_id" VARCHAR(255) NOT NULL UNIQUE,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "pending_paypal_payments_user_id_idx" ON "pending_paypal_payments"("user_id");
CREATE INDEX IF NOT EXISTS "pending_paypal_payments_expires_at_idx" ON "pending_paypal_payments"("expires_at");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pending_paypal_payments_user_id_fkey') THEN
    ALTER TABLE "pending_paypal_payments" ADD CONSTRAINT "pending_paypal_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pending_paypal_payments_plan_id_fkey') THEN
    ALTER TABLE "pending_paypal_payments" ADD CONSTRAINT "pending_paypal_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- offline_queue_items
CREATE TABLE IF NOT EXISTS "offline_queue_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "client_request_id" VARCHAR(128) NOT NULL,
    "idempotency_key" VARCHAR(128),
    "url" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "body" JSONB,
    "attachment_refs" TEXT[] NOT NULL DEFAULT '{}',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "state" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "moved_to_dead_letter_at" TIMESTAMPTZ,
    "original_retries" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "offline_queue_items_user_client_request_id_key" UNIQUE ("user_id", "client_request_id")
);
CREATE INDEX IF NOT EXISTS "offline_queue_items_user_id_state_idx" ON "offline_queue_items"("user_id", "state");
CREATE INDEX IF NOT EXISTS "offline_queue_items_state_idx" ON "offline_queue_items"("state");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offline_queue_items_user_id_fkey') THEN
    ALTER TABLE "offline_queue_items" ADD CONSTRAINT "offline_queue_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- activity_claims
CREATE TABLE IF NOT EXISTS "activity_claims" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "activity_id" VARCHAR(150) NOT NULL UNIQUE,
    "user_id" UUID NOT NULL,
    "claimed_by" VARCHAR(120) NOT NULL,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "activity_claims_user_id_idx" ON "activity_claims"("user_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='activity_claims_user_id_fkey') THEN
    ALTER TABLE "activity_claims" ADD CONSTRAINT "activity_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
