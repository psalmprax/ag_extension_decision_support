-- Farmer notes. Channel enrolment writes "Auto-enrolled via SMS [+2547...]" or
-- "[tg:<chat id>]" here, and inbound SMS, WhatsApp and Telegram handling reads it
-- (services/onboardingEngine.ts, services/chat/channelThread.ts). The column was used
-- in SQL but never created, so every channel message from a registered farmer failed.
-- IF NOT EXISTS keeps this safe on a database where it was added by hand.
ALTER TABLE "farmers" ADD COLUMN IF NOT EXISTS "notes" TEXT;
