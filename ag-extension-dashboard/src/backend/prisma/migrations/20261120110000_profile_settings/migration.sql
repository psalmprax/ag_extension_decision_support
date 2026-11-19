-- Profile personalisation saved on the account (handle, avatar, display units),
-- so it follows the user to every device instead of one browser's storage.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_settings" JSONB;
