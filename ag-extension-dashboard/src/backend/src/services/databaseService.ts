/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool } from 'pg';
import { execSync } from 'child_process';
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

    // Sync Prisma schema with database
    await syncPrismaSchema();

    // Create tables if they don't exist (legacy fallback)
    await createTables();

    // Seed initial data if tables are empty
    await seedInitialData();
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    // Continue without database for development
    logger.warn('Continuing without database connection');
  }
}

/**
 * Seeds the database with initial "Real-First" data for the dashboard.
 * Only seeds in development/test environments, never in production.
 */
export async function seedInitialData(): Promise<void> {
  if (!pool) return;

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    logger.info('Skipping seed data in production environment');
    return;
  }

  try {
    // 1. Seed Default Admin/Officer if no users exist
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    let officerId = '00000000-0000-0000-0000-000000000001';
    
    if (parseInt(userCount.rows[0].count) === 0) {
      logger.info('Seeding default officer...');
      await pool.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, is_active)
        VALUES ($1, 'demo@ag-extension.com', 'hashed_password', 'Demo', 'User', 'admin', 'Central Region', '+254712345678', true)
      `, [officerId]);
    } else {
      // Get existing user ID if it's the demo one or just pick first one
      const existingUser = await pool.query('SELECT id FROM users LIMIT 1');
      officerId = existingUser.rows[0].id;
    }

    // 2. Seed Farmers if empty
    const farmerCount = await pool.query('SELECT COUNT(*) FROM farmers');
    let farmerId = '00000000-0000-0000-0000-000000000002';
    if (parseInt(farmerCount.rows[0].count) === 0) {
      logger.info('Seeding initial farmers...');
      await pool.query(`
        INSERT INTO farmers (id, user_id, first_name, last_name, location, village, region, crops, farm_size_hectares, temperature, soil_moisture, ph_level, ai_confidence)
        VALUES ($1, $2, 'John', 'Kariuki', 'Kiambu County', 'Limuru', 'Central Region', ARRAY['Maize', 'Beans'], 2.5, 22.5, 45.0, 6.5, 88.0)
      `, [farmerId, officerId]);
    } else {
      const existingFarmer = await pool.query('SELECT id FROM farmers LIMIT 1');
      farmerId = existingFarmer.rows[0].id;
    }

    // 3. Seed Market Prices if empty
    const priceCount = await pool.query('SELECT COUNT(*) FROM market_prices');
    if (parseInt(priceCount.rows[0].count) === 0) {
      logger.info('Seeding initial market prices...');
      await pool.query(`
        INSERT INTO market_prices (crop, price, trend)
        VALUES 
        ('White Maize (90kg)', 'KES 4,200', '+5%'),
        ('Dry Beans (90kg)', 'KES 12,500', '-2%'),
        ('Sorghum (90kg)', 'KES 3,800', '+1%'),
        ('Finger Millet (90kg)', 'KES 9,200', 'Stable')
      `);
    }

    // 4. Seed Alerts if empty
    const alertCount = await pool.query('SELECT COUNT(*) FROM alerts');
    if (parseInt(alertCount.rows[0].count) === 0) {
      logger.info('Seeding initial alerts...');
      await pool.query(`
        INSERT INTO alerts (type, severity, title, description, location, affected_farmers, is_active)
        VALUES 
        ('pest', 'high', 'Fall Armyworm Outbreak', 'High infestation reported in Kiambu. Immediate scouting and localized spraying recommended.', 'Central Region', $1, true),
        ('weather', 'medium', 'Late Season Frost Warning', 'Predicted temperature drop below 5°C on Tuesday night. Protective mulching advised.', 'Central Region', $1, true)
      `, [[farmerId]]);
    }

    // 5. Seed Visits if empty
    const visitCount = await pool.query('SELECT COUNT(*) FROM visits');
    if (parseInt(visitCount.rows[0].count) === 0) {
      logger.info('Seeding initial visits and yield history...');
      await pool.query(`
        INSERT INTO visits (officer_id, farmer_id, visit_type, status, scheduled_at, completed_at, notes, outcomes)
        VALUES 
        ($1, $2, 'routine', 'completed', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 'Initial planting check.', 'Excellent seedbed preparation. Advised on spacing.'),
        ($1, $2, 'pest_control', 'completed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', 'Mid-season health scan.', 'Slight nitrogen deficiency detected. Top-dressing applied.')
      `, [officerId, farmerId]);
    }

    // 6. Seed Conversations if empty
    const chatCount = await pool.query('SELECT COUNT(*) FROM chat_conversations');
    if (parseInt(chatCount.rows[0].count) === 0) {
      logger.info('Seeding initial chat history for performance index...');
      const convId = '00000000-0000-0000-0000-000000000003';
      await pool.query(`
        INSERT INTO chat_conversations (id, farmer_id, officer_id, status, satisfaction_score, language)
        VALUES ($1, $2, $3, 'resolved', 5, 'en')
      `, [convId, farmerId, officerId]);

      await pool.query(`
        INSERT INTO chat_messages (conversation_id, role, content)
        VALUES ($1, 'farmer', 'When should I apply the first top-dressing for maize?'),
               ($1, 'assistant', 'Top-dressing should typically be applied when the maize is knee-high, roughly 3-4 weeks after planting.')
      `, [convId]);
    }

    logger.info('Dashboard data verification and seeding completed successfully');
  } catch (error) {
    logger.error('Error seeding initial data:', error);
  }
}

async function syncPrismaSchema(): Promise<void> {
  try {
    // Only run schema sync in development/test environments
    // In production, this must be run manually as part of deployment pipeline
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      logger.info('Skipping Prisma schema sync in production (run manually during deployment)');
      return;
    }

    logger.info('Syncing Prisma schema with database (development only)...');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    });
    await prisma.$executeRaw`SELECT 1`; // Test connection
    await prisma.$disconnect();

    // Only run schema push in development, without dangerous flags
    execSync('npx prisma db push', {
      stdio: 'pipe',
      env: { ...process.env }
    });
    logger.info('Prisma schema synced successfully');
  } catch (error) {
    logger.warn('Prisma schema sync skipped:', error);
  }
}

export async function createTables(): Promise<void> {
  if (!pool) return;

  let hasVector = false;
  try {
    const res = await pool.query("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') as has_vector");
    hasVector = res.rows[0].has_vector;
  } catch (err) {
    logger.debug('Error checking for vector type: ' + err);
  }

  const cosineSimilaritySQL = hasVector
    ? `
    CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[]) RETURNS float8 AS $$
    BEGIN
        IF a IS NULL OR b IS NULL OR array_length(a, 1) != array_length(b, 1) THEN
            RETURN 0;
        END IF;
        RETURN 1 - (a::real[]::vector <=> b::real[]::vector);
    END;
    $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `
    : `
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
    `;

  const createTablesSQL = `
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
      reset_token VARCHAR(255),
      reset_token_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Ensure reset columns exist for existing databases
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

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
      soil_moisture DECIMAL(5, 2),
      temperature DECIMAL(5, 2),
      ph_level DECIMAL(4, 2),
      ai_confidence DECIMAL(5, 2),
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
      notification_sent BOOLEAN DEFAULT false,
      alert_notification_sent BOOLEAN DEFAULT false,
      triggered_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- market_prices table
    CREATE TABLE IF NOT EXISTS market_prices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crop VARCHAR(100) NOT NULL,
      price VARCHAR(50) NOT NULL,
      trend VARCHAR(20) NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- SMS history table
    CREATE TABLE IF NOT EXISTS sms_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID REFERENCES users(id),
      recipient_phone VARCHAR(20) NOT NULL,
      farmer_id UUID REFERENCES farmers(id),
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      provider VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Tropical knowledge sources table
    CREATE TABLE IF NOT EXISTS tropical_knowledge_sources (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      license TEXT,
      url TEXT NOT NULL,
      sync_mode VARCHAR(50) NOT NULL,
      topics TEXT[],
      crops TEXT[],
      regions TEXT[],
      description TEXT,
      priority VARCHAR(20) DEFAULT 'medium',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Search cache table for RAG answer caching
    CREATE TABLE IF NOT EXISTS search_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query_text TEXT NOT NULL,
      normalized_query TEXT NOT NULL,
      answer TEXT,
      context_used JSONB,
      visuals JSONB,
      embedding float8[],
      created_at TIMESTAMP DEFAULT NOW()
    );
    -- Unique index on normalized query for O(1) exact match lookups
    CREATE UNIQUE INDEX IF NOT EXISTS idx_search_cache_normalized ON search_cache(normalized_query);

    -- Knowledge search history table
    CREATE TABLE IF NOT EXISTS knowledge_searches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      query TEXT NOT NULL,
      category VARCHAR(100),
      crop VARCHAR(100),
      answer TEXT,
      reasoning TEXT,
      visuals JSONB,
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
    CREATE INDEX IF NOT EXISTS idx_sms_history_farmer ON sms_history(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_sms_history_created ON sms_history(created_at);
    -- Knowledge search performance indexes
    CREATE INDEX IF NOT EXISTS idx_knowledge_searches_user ON knowledge_searches(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache(LOWER(TRIM(query_text)));
    -- GIN index for full-text search on knowledge articles (avoids computing to_tsvector per row)
    CREATE INDEX IF NOT EXISTS idx_knowledge_fts ON knowledge_articles USING gin(to_tsvector('english', title || ' ' || content));
    -- GIN index on crops array for = ANY(crops) queries
    CREATE INDEX IF NOT EXISTS idx_knowledge_crops ON knowledge_articles USING gin(crops);
  `;

  // IVFFlat indexes for pgvector similarity search (O(log n) vs O(n) sequential scan)
  const ivfflatIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_knowledge_articles_embedding_ivfflat
        ON knowledge_articles USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_search_cache_embedding_ivfflat
        ON search_cache USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
  `;

  try {
    await pool.query(cosineSimilaritySQL);
    await pool.query(createTablesSQL);
    // Create IVFFlat indexes (requires pgvector extension and data in tables)
    try {
      await pool.query(ivfflatIndexSQL);
      logger.info('IVFFlat indexes created for vector similarity search');
    } catch (ivfErr) {
      logger.debug('IVFFlat index creation skipped (pgvector extension or tables not ready):', ivfErr);
    }
    logger.info('Database tables and functions created');
  } catch (error) {
    logger.warn('Error during database provisioning:', error);
  }
}

export function getPool(): Pool | null {
  return pool;
}

/**
 * Get connection pool statistics for monitoring
 */
export function getPoolStats(): { connected: boolean; totalCount: number; idleCount: number; waitingCount: number } {
  if (!pool) {
    return { connected: false, totalCount: 0, idleCount: 0, waitingCount: 0 };
  }
  return {
    connected: true,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
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
