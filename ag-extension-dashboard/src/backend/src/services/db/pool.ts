import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { getPrisma } from '../prismaService';
import { createTables } from './schema';

let pool: Pool | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    // Test connection with retry
    let client: PoolClient | null = null;
    let retries = 5;
    while (retries > 0) {
      try {
        client = await pool.connect();
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        logger.warn(`Database connection attempt failed, retrying in 2 seconds... (${retries} retries left):`, err instanceof Error ? err.message : err);
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    if (!client) {
      throw new Error('Database client connection failed');
    }

    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection established');

    // Initialize Prisma
    getPrisma();
    logger.info('Prisma ORM initialized');

    // Sync Prisma schema with database
    await syncPrismaSchema();

    // Create tables if they don't exist (legacy fallback)
    await createTables(pool);

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
async function seedInitialData(): Promise<void> {
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
      const passwordHash = await bcrypt.hash(config.demo.password, 10);
      await pool.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, role, region, phone, is_active, is_demo)
        VALUES ($1, 'demo@agridemo.com', $2, 'Demo', 'User', 'extension_officer', 'Kenya', '+254700000000', true, true)
      `, [officerId, passwordHash]);
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
        INSERT INTO farmers (id, user_id, assigned_officer_id, first_name, last_name, location, village, region, crops, farm_size_hectares, temperature, soil_moisture, ph_level, ai_confidence, is_demo)
        VALUES ($1, $2, $2, 'Emmanuel', 'Mwangi', 'Machakos Rural, Eastern Zone', 'Kathiani', 'Machakos', ARRAY['Maize', 'Beans'], 3.5, 23.5, 42.0, 6.1, 74.0, true)
      `, [farmerId, officerId]);
    } else {
      const existingFarmer = await pool.query('SELECT id FROM farmers LIMIT 1');
      farmerId = existingFarmer.rows[0].id;
    }

    // 3. Seed Alerts if empty
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
    const isProduction = process.env.NODE_ENV === 'production';
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
    });
    await prisma.$executeRaw`SELECT 1`; // Test connection
    await prisma.$disconnect();

    const cmd = isProduction ? 'npx prisma migrate deploy' : 'npx prisma db push';
    logger.info(`Running database schema sync: ${cmd}`);
    const output = execSync(cmd, {
      stdio: 'pipe',
      env: { ...process.env }
    });
    logger.info('Database schema sync output:\n' + output.toString());
  } catch (error) {
    logger.warn('Prisma schema sync / migration failed:', error);
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

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}
