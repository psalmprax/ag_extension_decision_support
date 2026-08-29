-- Outreach message queue consumed by src/workers/outreachWorker.ts.
-- Idempotent: the worker also bootstraps this table at runtime, so it may
-- already exist when this migration runs. Column types match the worker DDL
-- exactly so `prisma db push` sees no drift.
CREATE TABLE IF NOT EXISTS "outreach_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmer_id" UUID,
    "recipient" VARCHAR(64),
    "message" TEXT NOT NULL,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'sms',
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_outreach_messages_status" ON "outreach_messages"("status", "created_at");