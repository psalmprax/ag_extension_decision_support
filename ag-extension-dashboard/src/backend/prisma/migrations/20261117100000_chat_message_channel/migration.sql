-- Where a farmer-thread message came from or went to: NULL is the app;
-- sms / whatsapp / telegram mark messages received or delivered on that channel.
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_channel_check'
    ) THEN
        ALTER TABLE "chat_messages"
            ADD CONSTRAINT "chat_messages_channel_check" CHECK ("channel" IS NULL OR "channel" IN ('sms', 'whatsapp', 'telegram'));
    END IF;
END $$;
