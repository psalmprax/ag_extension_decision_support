-- Add more alert tracking columns

-- Subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS expiry_notification_sent BOOLEAN DEFAULT FALSE;

-- Chat conversations table
ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS low_satisfaction_alert_sent BOOLEAN DEFAULT FALSE;

-- Farmers table
ALTER TABLE farmers
ADD COLUMN IF NOT EXISTS assignment_notification_sent BOOLEAN DEFAULT FALSE;
