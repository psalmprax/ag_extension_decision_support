/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool } from 'pg';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { getPrisma } from './prismaService';

let pool: Pool | null = null;

export async function initializeDatabase(): Promise<void> {
    try {
        pool = new Pool({
            connectionString: config.database.url,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();

        logger.info('Database connection established');

        // Initialize Prisma
        getPrisma();
        logger.info('Prisma ORM initialized');

        // Create tables if they don't exist
        await createTables();
    } catch (error) {
        logger.error('Failed to initialize database:', error);
        // Continue without database for development
        logger.warn('Continuing without database connection');
    }
}

export async function createTables(): Promise<void> {
    if (!pool) return;

    const createTablesSQL = `
    -- Fallback cosine similarity function
    CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[]) RETURNS float8 AS $$
    DECLARE
        dot_product float8 := 0;
        mag_a float8 := 0;
        mag_b float8 := 0;
    BEGIN
        IF a IS NULL OR b IS NULL OR array_length(a, 1) != array_length(b, 1) THEN
            RETURN 0;
        END IF;
        FOR i IN 1..array_length(a, 1) LOOP
            dot_product := dot_product + (a[i] * b[i]);
            mag_a := mag_a + (a[i] * a[i]);
            mag_b := mag_b + (b[i] * b[i]);
        END LOOP;
        IF mag_a = 0 OR mag_b = 0 THEN
            RETURN 0;
        END IF;
        RETURN dot_product / (sqrt(mag_a) * sqrt(mag_b));
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'extension_officer',
      region VARCHAR(100),
      phone VARCHAR(20),
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Farmers table
    CREATE TABLE IF NOT EXISTS farmers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      location VARCHAR(255),
      village VARCHAR(100),
      district VARCHAR(100),
      region VARCHAR(100),
      country VARCHAR(100) DEFAULT 'Kenya',
      farm_size_hectares DECIMAL(10, 2),
      crops TEXT[],
      language_preference VARCHAR(20) DEFAULT 'en',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Visits table
    CREATE TABLE IF NOT EXISTS visits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      officer_id UUID REFERENCES users(id),
      farmer_id UUID REFERENCES farmers(id),
      visit_type VARCHAR(50) DEFAULT 'routine',
      status VARCHAR(50) DEFAULT 'scheduled',
      scheduled_at TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      duration_minutes INTEGER,
      location_lat DECIMAL(10, 8),
      location_lng DECIMAL(11, 8),
      notes TEXT,
      outcomes TEXT,
      follow_up_required BOOLEAN DEFAULT false,
      follow_up_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Knowledge articles table
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category VARCHAR(100),
      tags TEXT[],
      crops TEXT[],
      regions TEXT[],
      source VARCHAR(255),
      source_url TEXT,
      embedding float8[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Chat conversations table
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      farmer_id UUID REFERENCES farmers(id),
      officer_id UUID REFERENCES users(id),
      language VARCHAR(20) DEFAULT 'en',
      status VARCHAR(50) DEFAULT 'active',
      started_at TIMESTAMP DEFAULT NOW(),
      ended_at TIMESTAMP,
      satisfaction_score INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES chat_conversations(id),
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      language VARCHAR(20),
      translated_content TEXT,
      intent VARCHAR(100),
      entities JSONB,
      is_voice BOOLEAN DEFAULT false,
      audio_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Reports table
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content JSONB NOT NULL,
      generated_by UUID REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Analytics events table
    CREATE TABLE IF NOT EXISTS analytics_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(100) NOT NULL,
      user_id UUID REFERENCES users(id),
      farmer_id UUID REFERENCES farmers(id),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Alerts table
    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) DEFAULT 'medium',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      location VARCHAR(255),
      affected_farmers UUID[],
      is_active BOOLEAN DEFAULT true,
      triggered_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_farmers_region ON farmers(region);
    CREATE INDEX IF NOT EXISTS idx_visits_officer ON visits(officer_id);
    CREATE INDEX IF NOT EXISTS idx_visits_farmer ON visits(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
    CREATE INDEX IF NOT EXISTS idx_conversations_farmer ON chat_conversations(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active);
  `;

    try {
        await pool.query(createTablesSQL);
        logger.info('Database tables and functions created');
    } catch (error) {
        logger.warn('Error during database provisioning:', error);
    }
}

export function getPool(): Pool | null {
    return pool;
}

export async function query(text: string, params?: any[]): Promise<any> {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
}

export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database connection closed');
    }
}
