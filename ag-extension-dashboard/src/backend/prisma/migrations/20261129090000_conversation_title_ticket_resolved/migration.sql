-- Columns the app already writes: an officer renaming one of their AI chats, and when a
-- support ticket was resolved. Without them both actions failed.
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "title" VARCHAR(120);
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(6);
