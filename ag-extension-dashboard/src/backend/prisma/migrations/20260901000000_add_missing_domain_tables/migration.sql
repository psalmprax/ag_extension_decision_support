-- Add missing domain tables: support_tickets, whatsapp_messages, sms_feedback
-- Idempotent — safe to re-run

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- support_tickets
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "created_by" UUID NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "support_tickets_created_by_idx" ON "support_tickets"("created_by");
CREATE INDEX IF NOT EXISTS "support_tickets_tenant_id_idx" ON "support_tickets"("tenant_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_tickets_created_by_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_tickets_assigned_to_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_tickets_tenant_id_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- whatsapp_messages
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "from_phone" VARCHAR(20),
    "to_phone" VARCHAR(20) NOT NULL,
    "body" TEXT NOT NULL,
    "direction" VARCHAR(20) NOT NULL DEFAULT 'outbound',
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "provider_id" VARCHAR(255),
    "farmer_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "whatsapp_messages_to_phone_idx" ON "whatsapp_messages"("to_phone");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_farmer_id_idx" ON "whatsapp_messages"("farmer_id");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_tenant_id_idx" ON "whatsapp_messages"("tenant_id");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_status_idx" ON "whatsapp_messages"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='whatsapp_messages_farmer_id_fkey') THEN
    ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='whatsapp_messages_tenant_id_fkey') THEN
    ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- sms_feedback
CREATE TABLE IF NOT EXISTS "sms_feedback" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "sms_history_id" UUID,
    "farmer_id" UUID,
    "rating" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sms_feedback_farmer_id_idx" ON "sms_feedback"("farmer_id");
CREATE INDEX IF NOT EXISTS "sms_feedback_tenant_id_idx" ON "sms_feedback"("tenant_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sms_feedback_farmer_id_fkey') THEN
    ALTER TABLE "sms_feedback" ADD CONSTRAINT "sms_feedback_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sms_feedback_tenant_id_fkey') THEN
    ALTER TABLE "sms_feedback" ADD CONSTRAINT "sms_feedback_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
  END IF;
END $$;
