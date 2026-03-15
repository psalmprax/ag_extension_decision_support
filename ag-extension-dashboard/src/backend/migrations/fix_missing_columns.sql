-- Migration: Add missing columns to tables
-- Run this script to fix missing columns in the database

-- Add is_active column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add is_active column to farmers table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'farmers' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE farmers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add is_active column to alerts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alerts' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE alerts ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add generated_at column to reports table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'generated_at'
    ) THEN
        ALTER TABLE reports ADD COLUMN generated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Add latitude and longitude columns to farmers table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'farmers' AND column_name = 'latitude'
    ) THEN
        ALTER TABLE farmers ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'farmers' AND column_name = 'longitude'
    ) THEN
        ALTER TABLE farmers ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
END $$;

-- Create index on is_active columns for better query performance
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_is_active'
    ) THEN
        CREATE INDEX idx_users_is_active ON users(is_active);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_farmers_is_active'
    ) THEN
        CREATE INDEX idx_farmers_is_active ON farmers(is_active);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_farmers_location'
    ) THEN
        CREATE INDEX idx_farmers_location ON farmers(latitude, longitude);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reports_generated_at'
    ) THEN
        CREATE INDEX idx_reports_generated_at ON reports(generated_at);
    END IF;
END $$;

-- Grant permissions (if needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO current_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO current_user;

SELECT 'Migration completed successfully!' as message;
