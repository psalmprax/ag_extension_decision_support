-- Per-user alert channel choices from Settings ({"emailAlerts": bool,
-- "smsAlerts": bool, "pushNotifications": bool}). NULL or a missing key means
-- the channel is on, so existing users keep receiving alerts as before.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_preferences" JSONB;
