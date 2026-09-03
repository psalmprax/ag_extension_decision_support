-- Add metered counters for AI vision, speech and WhatsApp so plan quotas are enforceable.
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "ai_vision_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "speech_count"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usage" ADD COLUMN IF NOT EXISTS "whatsapp_count"  INTEGER NOT NULL DEFAULT 0;
