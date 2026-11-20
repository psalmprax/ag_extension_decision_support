-- A farmer who texts STOP gets no more notices (visit reminders, broadcasts) until START.
-- Replies to their own messages still reach them.
ALTER TABLE "farmers" ADD COLUMN IF NOT EXISTS "sms_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "farmers" ADD COLUMN IF NOT EXISTS "sms_opt_out_at" TIMESTAMP(6);
