import { Pool, PoolClient } from 'pg';
import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
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

  // Provision durable operation-state tables that replace earlier in-memory
  // stores (PayPal pending payments, extension offline queue, triage claims).
  // All statements are idempotent.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_paypal_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id VARCHAR(255) NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        plan_id UUID NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS pending_paypal_payments_user_id_idx ON pending_paypal_payments(user_id);
      CREATE INDEX IF NOT EXISTS pending_paypal_payments_expires_at_idx ON pending_paypal_payments(expires_at);

      CREATE TABLE IF NOT EXISTS offline_queue_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        client_request_id VARCHAR(128) NOT NULL,
        idempotency_key VARCHAR(128),
        url VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        headers JSONB NOT NULL DEFAULT '{}'::jsonb,
        body JSONB,
        attachment_refs TEXT[] NOT NULL DEFAULT '{}',
        retries INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        state VARCHAR(20) NOT NULL DEFAULT 'pending',
        last_error TEXT,
        moved_to_dead_letter_at TIMESTAMPTZ,
        original_retries INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT offline_queue_items_user_client_request_id_key UNIQUE (user_id, client_request_id)
      );
      CREATE INDEX IF NOT EXISTS offline_queue_items_user_id_state_idx ON offline_queue_items(user_id, state);
      CREATE INDEX IF NOT EXISTS offline_queue_items_state_idx ON offline_queue_items(state);

      CREATE TABLE IF NOT EXISTS activity_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        activity_id VARCHAR(150) NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        claimed_by VARCHAR(120) NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS activity_claims_user_id_idx ON activity_claims(user_id);
    `);
    logger.info('Durable operation-state tables provisioned (paypal pending, offline queue, activity claims)');
  } catch (error) {
    logger.warn('Durable operation-state provisioning failed:', error);
  }

  // Provision governance tables for environments that use the legacy bootstrap
  // path instead of Prisma migrations. All statements are idempotent.
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID;
      ALTER TABLE farmers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
      UPDATE users SET is_demo = true WHERE id = '00000000-0000-0000-0000-000000000001';
      UPDATE users SET is_demo = true WHERE lower(COALESCE(email,'')) = 'demo@agridemo.com';
      UPDATE users SET is_demo = true WHERE lower(COALESCE(first_name,'')) = 'demo' OR lower(COALESCE(last_name,'')) = 'demo';
      UPDATE farmers SET is_demo = true WHERE id = '00000000-0000-0000-0000-000000000002';

      -- Tenant-scoping + relationship-gap columns (legacy bootstrap parity).
      ALTER TABLE visits ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS farmer_id UUID;
      CREATE INDEX IF NOT EXISTS visits_tenant_id_idx ON visits(tenant_id);
      CREATE INDEX IF NOT EXISTS chat_conversations_tenant_id_idx ON chat_conversations(tenant_id);
      CREATE INDEX IF NOT EXISTS alerts_tenant_id_idx ON alerts(tenant_id);
      CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON notifications(tenant_id);
      CREATE INDEX IF NOT EXISTS notifications_farmer_id_idx ON notifications(farmer_id);
      CREATE INDEX IF NOT EXISTS reports_tenant_id_idx ON reports(tenant_id);

      CREATE TABLE IF NOT EXISTS farmer_assignment_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
        officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reassigned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        assigned_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS farmer_assignment_history_farmer_idx ON farmer_assignment_history(farmer_id);
      CREATE INDEX IF NOT EXISTS farmer_assignment_history_officer_idx ON farmer_assignment_history(officer_id);

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

      CREATE TABLE IF NOT EXISTS tenant_channel_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        channel VARCHAR(30) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT false,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        auto_onboarding BOOLEAN NOT NULL DEFAULT true,
        welcome_template TEXT,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, channel)
      );
      CREATE INDEX IF NOT EXISTS tenant_channel_configs_tenant_channel_idx ON tenant_channel_configs(tenant_id, channel);

      CREATE TABLE IF NOT EXISTS telegram_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        chat_id VARCHAR(64) NOT NULL,
        username VARCHAR(100),
        first_name VARCHAR(100),
        message TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL DEFAULT 'inbound',
        status VARCHAR(20) NOT NULL DEFAULT 'received',
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS telegram_messages_chat_id_idx ON telegram_messages(chat_id);
      CREATE INDEX IF NOT EXISTS telegram_messages_farmer_id_idx ON telegram_messages(farmer_id);

      CREATE TABLE IF NOT EXISTS recommendation_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        officer_id UUID,
        crop VARCHAR(100) NOT NULL,
        advice_category VARCHAR(100) NOT NULL,
        advice_summary TEXT NOT NULL,
        outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('resolved','improved','unresolved','worsened','lost_to_followup')),
        follow_up_photo_id UUID,
        officer_notes TEXT,
        measured_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS recommendation_outcomes_visit_id_idx ON recommendation_outcomes(visit_id);
      CREATE INDEX IF NOT EXISTS recommendation_outcomes_farmer_id_idx ON recommendation_outcomes(farmer_id);
      CREATE INDEX IF NOT EXISTS recommendation_outcomes_officer_measured_idx ON recommendation_outcomes(officer_id, measured_at);
      CREATE INDEX IF NOT EXISTS recommendation_outcomes_crop_category_idx ON recommendation_outcomes(crop, advice_category);

      CREATE TABLE IF NOT EXISTS advisory_preferences (
        farmer_id UUID PRIMARY KEY REFERENCES farmers(id) ON DELETE CASCADE,
        opt_in BOOLEAN NOT NULL DEFAULT true,
        channels VARCHAR(20)[] DEFAULT '{whatsapp}',
        categories VARCHAR(40)[] DEFAULT '{planting_window,dry_spell_warning,faw_degree_day,late_blight_risk}',
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS advisory_dispatches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_key VARCHAR(60) NOT NULL,
        district VARCHAR(100) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        audience_count INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        dedupe_hash CHAR(64) NOT NULL UNIQUE,
        dispatched_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS advisory_dispatches_rule_district_idx ON advisory_dispatches(rule_key, district, dispatched_at);

      CREATE TABLE IF NOT EXISTS diagnosis_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        district VARCHAR(100),
        crop VARCHAR(100) NOT NULL,
        disease_label VARCHAR(150) NOT NULL,
        confidence DOUBLE PRECISION,
        source VARCHAR(30) NOT NULL DEFAULT 'extension_tool',
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS diagnosis_events_district_crop_idx ON diagnosis_events(district, crop, created_at);
      CREATE INDEX IF NOT EXISTS diagnosis_events_created_at_idx ON diagnosis_events(created_at);

      CREATE TABLE IF NOT EXISTS district_adjacency (
        district VARCHAR(100) NOT NULL,
        adjacent_district VARCHAR(100) NOT NULL,
        PRIMARY KEY (district, adjacent_district)
      );

      ALTER TABLE crop_cycles ADD COLUMN IF NOT EXISTS plan_json JSONB;
      ALTER TABLE crop_cycles ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMP(6);

      CREATE TABLE IF NOT EXISTS crop_cycle_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crop_cycle_id UUID NOT NULL REFERENCES crop_cycles(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'input',
        due_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','missed')),
        completed_at TIMESTAMP(6),
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS crop_cycle_milestones_cycle_idx ON crop_cycle_milestones(crop_cycle_id, due_date);

      CREATE TABLE IF NOT EXISTS soil_lab_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
        lab_name VARCHAR(150),
        sample_ref VARCHAR(100),
        ph DECIMAL(4,2),
        nitrogen_ppm DECIMAL(8,2),
        phosphorus_ppm DECIMAL(8,2),
        potassium_ppm DECIMAL(8,2),
        organic_matter_pct DECIMAL(5,2),
        raw JSONB,
        tested_at TIMESTAMP(6),
        imported_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS soil_lab_results_farmer_idx ON soil_lab_results(farmer_id, tested_at);

      CREATE TABLE IF NOT EXISTS farmer_onboarding_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        channel VARCHAR(30) NOT NULL,
        external_identifier VARCHAR(64) NOT NULL,
        step VARCHAR(40) NOT NULL DEFAULT 'awaiting_name',
        collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel, external_identifier)
      );
      CREATE INDEX IF NOT EXISTS farmer_onboarding_channel_identifier_idx ON farmer_onboarding_sessions(channel, external_identifier);

      CREATE TABLE IF NOT EXISTS autonomous_campaign_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        goal_prompt TEXT NOT NULL,
        target_region VARCHAR(100),
        target_crop VARCHAR(100),
        status VARCHAR(30) NOT NULL DEFAULT 'completed',
        affected_farmers_count INTEGER NOT NULL DEFAULT 0,
        dispatched_messages_count INTEGER NOT NULL DEFAULT 0,
        scheduled_visits_count INTEGER NOT NULL DEFAULT 0,
        execution_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
        advisory_summary TEXT,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS autonomous_campaign_runs_tenant_idx ON autonomous_campaign_runs(tenant_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS regional_agronomy_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        region VARCHAR(100) NOT NULL,
        crop VARCHAR(100) NOT NULL,
        topic VARCHAR(120) NOT NULL,
        title VARCHAR(200) NOT NULL,
        skill_markdown TEXT NOT NULL,
        source_type VARCHAR(40) NOT NULL DEFAULT 'field_visit',
        source_visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        confidence_score NUMERIC(5,2) DEFAULT 0.90,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS regional_agronomy_skills_region_crop_idx ON regional_agronomy_skills(region, crop);

      -- Login history and last login tracking
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[] NOT NULL DEFAULT '{}';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP(6);

      CREATE TABLE IF NOT EXISTS login_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        failure_reason VARCHAR(100),
        ip_address VARCHAR(64),
        user_agent VARCHAR(512),
        device VARCHAR(100),
        location VARCHAR(150),
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS login_history_user_id_created_at_idx ON login_history(user_id, created_at);
      CREATE INDEX IF NOT EXISTS login_history_email_created_at_idx ON login_history(email, created_at);
      CREATE INDEX IF NOT EXISTS login_history_status_idx ON login_history(status);

      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(64),
        user_agent VARCHAR(512),
        device VARCHAR(100),
        location VARCHAR(150),
        last_active_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP(6) NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS user_sessions_user_id_revoked_idx ON user_sessions(user_id, is_revoked);
      CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions(token_hash);
    `);
    logger.info('Tenant, login-history, sessions, and data-governance tables provisioned');
  } catch (error) {
    logger.warn('Tenant, login-history, sessions, and data-governance provisioning failed:', error);
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
