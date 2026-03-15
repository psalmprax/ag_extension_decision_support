-- Add columns for alert tracking to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overdue_alert_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_reminder_sent BOOLEAN DEFAULT FALSE;

-- Add column for tracking alert notifications
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS alert_notification_sent BOOLEAN DEFAULT FALSE;

-- Create index for faster alert queries
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_at ON visits(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
