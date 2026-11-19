-- When each side of a farmer thread last read it: drives the unread badges.
-- (The read receipt used to set ended_at, which says nothing about who read.)
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "officer_read_at" TIMESTAMP(6);
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "farmer_read_at" TIMESTAMP(6);
