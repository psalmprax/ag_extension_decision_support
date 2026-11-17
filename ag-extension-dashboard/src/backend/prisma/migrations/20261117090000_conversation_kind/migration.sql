-- Separate farmers' threads from officers' private AI chats.
ALTER TABLE "chat_conversations"
    ADD COLUMN IF NOT EXISTS "kind" VARCHAR(20) NOT NULL DEFAULT 'farmer_thread';

-- Existing conversations: a conversation started by a staff member in which the
-- farmer has never written (it has messages, but none from the farmer), or one
-- with no farmer at all, is an officer's private AI chat. Everything else stays
-- a farmer thread, so no farmer loses a conversation they took part in.
UPDATE "chat_conversations" cv
   SET "kind" = 'officer_ai'
 WHERE EXISTS (SELECT 1 FROM "users" u WHERE u."id" = cv."officer_id" AND u."role" <> 'farmer')
   AND (
        cv."farmer_id" IS NULL
     OR (
            EXISTS (SELECT 1 FROM "chat_messages" m WHERE m."conversation_id" = cv."id")
        AND NOT EXISTS (
                SELECT 1 FROM "chat_messages" m
                 WHERE m."conversation_id" = cv."id" AND m."role" IN ('user', 'farmer')
            )
        )
   );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_kind_check'
    ) THEN
        ALTER TABLE "chat_conversations"
            ADD CONSTRAINT "chat_conversations_kind_check" CHECK ("kind" IN ('farmer_thread', 'officer_ai'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "chat_conversations_kind_idx" ON "chat_conversations" ("kind");
