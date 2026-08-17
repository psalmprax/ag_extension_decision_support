import { Pool, PoolClient } from 'pg';
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

export async function createTables(): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offline_mutations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        mutation_key VARCHAR(128) NOT NULL,
        operation VARCHAR(20) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        response_status INTEGER,
        response_body JSONB,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT offline_mutations_user_key_unique UNIQUE (user_id, mutation_key)
      );
      CREATE INDEX IF NOT EXISTS offline_mutations_user_id_idx ON offline_mutations(user_id);
      CREATE INDEX IF NOT EXISTS offline_mutations_status_idx ON offline_mutations(status);
    `);
  } catch (error) {
    logger.warn('Offline mutation ledger provisioning failed:', error);
  }

  // Provision governance tables for environments that use the legacy bootstrap
  // path instead of Prisma migrations. All statements are idempotent.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(160) NOT NULL,
        region VARCHAR(100),
        default_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        default_language VARCHAR(20) NOT NULL DEFAULT 'en',
        capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE farmers ADD COLUMN IF NOT EXISTS tenant_id UUID;
      INSERT INTO tenants (name)
      SELECT 'Default tenant'
      WHERE NOT EXISTS (SELECT 1 FROM tenants);
      UPDATE users
      SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
      WHERE tenant_id IS NULL;
      UPDATE farmers
      SET tenant_id = COALESCE(
        (SELECT u.tenant_id FROM users u WHERE u.id = farmers.user_id),
        (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
      )
      WHERE tenant_id IS NULL;
      CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS farmers_tenant_id_idx ON farmers(tenant_id);

      CREATE TABLE IF NOT EXISTS tenant_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, user_id)
      );
      INSERT INTO tenant_memberships (tenant_id, user_id, role)
      SELECT u.tenant_id, u.id, u.role
      FROM users u
      WHERE u.tenant_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM tenant_memberships tm
          WHERE tm.tenant_id = u.tenant_id AND tm.user_id = u.id
        );
      CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON tenant_memberships(user_id);

      CREATE TABLE IF NOT EXISTS data_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
        recorded_by UUID NOT NULL REFERENCES users(id),
        purpose VARCHAR(120) NOT NULL,
        version VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'granted',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        consented_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        withdrawn_at TIMESTAMP(6)
      );
      CREATE INDEX IF NOT EXISTS data_consents_farmer_purpose_idx ON data_consents(farmer_id, purpose, status);
      CREATE INDEX IF NOT EXISTS data_consents_tenant_id_idx ON data_consents(tenant_id);

      CREATE TABLE IF NOT EXISTS data_export_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
        requested_by UUID NOT NULL REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP(6)
      );
      CREATE INDEX IF NOT EXISTS data_export_requests_farmer_id_idx ON data_export_requests(farmer_id);
      CREATE INDEX IF NOT EXISTS data_export_requests_tenant_id_idx ON data_export_requests(tenant_id);

      CREATE TABLE IF NOT EXISTS upload_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        storage_key VARCHAR(255) NOT NULL UNIQUE,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
        sha256 CHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP(6)
      );
      CREATE INDEX IF NOT EXISTS upload_records_owner_user_id_idx ON upload_records(owner_user_id);
      CREATE INDEX IF NOT EXISTS upload_records_farmer_id_idx ON upload_records(farmer_id);
      CREATE INDEX IF NOT EXISTS upload_records_tenant_id_idx ON upload_records(tenant_id);
      CREATE TABLE IF NOT EXISTS visit_attachments (
        visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        upload_id UUID NOT NULL REFERENCES upload_records(id) ON DELETE RESTRICT,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (visit_id, upload_id)
      );
      CREATE INDEX IF NOT EXISTS visit_attachments_upload_id_idx ON visit_attachments(upload_id);
      CREATE TABLE IF NOT EXISTS recommendation_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        recommendation TEXT NOT NULL,
        confidence NUMERIC(5,2),
        evidence_status VARCHAR(40) NOT NULL DEFAULT 'no_verified_source',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        disposition TEXT,
        reviewed_by UUID REFERENCES users(id),
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP(6)
      );
      CREATE INDEX IF NOT EXISTS recommendation_reviews_tenant_status_idx ON recommendation_reviews(tenant_id, status);
      CREATE INDEX IF NOT EXISTS recommendation_reviews_farmer_id_idx ON recommendation_reviews(farmer_id);
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id VARCHAR(100) PRIMARY KEY,
        agent_id VARCHAR(100) NOT NULL,
        task_type VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL,
        created_at TIMESTAMP(6) NOT NULL,
        started_at TIMESTAMP(6),
        completed_at TIMESTAMP(6),
        result TEXT,
        error TEXT,
        handed_off_to VARCHAR(100),
        handoff_reason TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS agent_tasks_status_updated_idx ON agent_tasks(status, updated_at);
    `);
    logger.info('Tenant and data-governance tables provisioned');
  } catch (error) {
    logger.warn('Tenant and data-governance provisioning failed:', error);
  }

  // Enable vector extension if available in database
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    logger.info('pgvector extension enabled or checked');
  } catch (err) {
    logger.debug('pgvector extension check failed (might not be superuser or supported): ' + err);
  }

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

  const setupVectorsSQL = `
    -- Convert embedding columns to pgvector native type if still float8[]
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_articles' AND column_name = 'embedding' AND data_type = 'ARRAY') THEN
        ALTER TABLE knowledge_articles ALTER COLUMN embedding TYPE vector(768) USING embedding::real[]::vector;
      END IF;
    END $$;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_cache' AND column_name = 'embedding' AND data_type = 'ARRAY') THEN
        ALTER TABLE search_cache ALTER COLUMN embedding TYPE vector(768) USING embedding::real[]::vector;
      END IF;
    END $$;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding' AND data_type = 'ARRAY') THEN
        ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(768) USING embedding::real[]::vector;
      END IF;
    END $$;
  `;

  // IVFFlat indexes for pgvector similarity search (O(log n) vs O(n) sequential scan)
  const ivfflatIndexSQL = `
    CREATE INDEX IF NOT EXISTS idx_knowledge_articles_embedding_ivfflat
        ON knowledge_articles USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_search_cache_embedding_ivfflat
        ON search_cache USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_ivfflat
        ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
  `;

  try {
    await pool.query(cosineSimilaritySQL);
    if (hasVector) {
      await pool.query(setupVectorsSQL);
      try {
        await pool.query(ivfflatIndexSQL);
        logger.info('IVFFlat indexes created/verified for vector similarity search');
      } catch (ivfErr) {
        logger.debug('IVFFlat index creation/verification skipped:', ivfErr);
      }
    }
    logger.info('Database custom vector functions and indexes provisioned');
  } catch (error) {
    logger.warn('Error during database custom provisioning:', error);
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

/**
 * Shape returned by `query<T>()`. We use a custom return type (rather than
 * `pg.QueryResult<T>`) so callers don't have to satisfy `pg`'s
 * `QueryResultRow` constraint — the cast is trusted at the runtime boundary.
 */
export interface TypedQueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Default row type for untyped `query()` calls. Equivalent to
 * `pg.QueryResultRow` (`{ [column: string]: any }`) — preserves the
 * pre-generic behaviour so existing callers that do not pass a row type
 * continue to typecheck without modification. Prefer passing an explicit
 * row interface for new code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultSqlRow = { [column: string]: any };

/**
 * Execute a raw SQL query against the connection pool with a typed row shape.
 *
 * Pass a row-type parameter to narrow the `rows` array. The default is
 * `DefaultSqlRow` (`{ [column: string]: any }`) which preserves the
 * pre-generic behaviour — new code should pass an explicit row interface
 * from `types/dbRows.ts` for strict typing.
 *
 * **Row-type pattern (canonical for the codebase):**
 * - The row interface mirrors the exact shape returned by the SQL (snake_case
 *   column names as the `pg` driver emits them).
 * - Prefer a row type from `types/dbRows.ts` when one already exists.
 * - For ad-hoc SQL, define a small row interface alongside the call site.
 * - The runtime cast is trusted: TypeScript does not verify that the SQL
 *   columns actually match `T`. Keep row types and SQL in sync.
 *
 * @example
 *   // Typed — preferred for new code
 *   const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
 *   // Untyped — preserved for backward compatibility with existing callers
 *   const { rows } = await query('SELECT now() AS now');
 *
 * @typeParam T - Row shape returned by the query. Defaults to `DefaultSqlRow`.
 */
export async function query<T = DefaultSqlRow>(
  text: string,
  params?: unknown[]
): Promise<TypedQueryResult<T>> {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  return res as unknown as TypedQueryResult<T>;
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('Database not initialized');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}
