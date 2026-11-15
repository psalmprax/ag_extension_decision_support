-- Consolidation of runtime-provisioned DDL into the migration chain.
--
-- These objects were previously created only at application startup
-- (services/db/schema.ts and individual services' ensureTables/initialize),
-- which left prisma/migrations incomplete as a source of truth. Every
-- statement is IF NOT EXISTS, so this migration is a no-op on databases the
-- runtime DDL already provisioned, and provisions fresh databases fully.

-- lifted verbatim from services/db/schema.ts
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

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS tenant_channel_configs_tenant_channel_idx ON tenant_channel_configs(tenant_id, channel);

-- lifted verbatim from services/db/schema.ts
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

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS telegram_messages_chat_id_idx ON telegram_messages(chat_id);

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS telegram_messages_farmer_id_idx ON telegram_messages(farmer_id);

-- lifted verbatim from services/db/schema.ts
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

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS farmer_onboarding_channel_identifier_idx ON farmer_onboarding_sessions(channel, external_identifier);

-- lifted verbatim from services/db/schema.ts
CREATE TABLE IF NOT EXISTS messaging_inbound_events (
        channel VARCHAR(30) NOT NULL,
        external_identifier VARCHAR(128) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        response_message TEXT,
        farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (channel, external_identifier, event_id)
      );

-- lifted verbatim from services/db/schema.ts
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

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS autonomous_campaign_runs_tenant_idx ON autonomous_campaign_runs(tenant_id, created_at DESC);

-- lifted verbatim from services/db/schema.ts
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

-- lifted verbatim from services/db/schema.ts
CREATE INDEX IF NOT EXISTS regional_agronomy_skills_region_crop_idx ON regional_agronomy_skills(region, crop);

-- lifted verbatim from services/emailWorkflowService.ts
CREATE TABLE IF NOT EXISTS email_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'general',
          variables TEXT[] DEFAULT '{}',
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );

-- lifted verbatim from services/emailWorkflowService.ts
CREATE TABLE IF NOT EXISTS email_approvals (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email_data JSONB NOT NULL,
          requested_by VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMP,
          review_comment TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

-- lifted verbatim from services/persistentMemory.ts
CREATE TABLE IF NOT EXISTS agent_memories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'general',
          key VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          embedding FLOAT[],
          created_at TIMESTAMP DEFAULT NOW(),
          last_accessed_at TIMESTAMP DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          importance FLOAT DEFAULT 0.5,
          UNIQUE(user_id, category, key)
        );

-- lifted verbatim from services/agentTelemetry.ts
CREATE TABLE IF NOT EXISTS agent_telemetry (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          agent_id VARCHAR(100),
          tool_name VARCHAR(100),
          user_id VARCHAR(100),
          duration_ms INTEGER,
          tokens_used INTEGER,
          cost_usd FLOAT,
          status VARCHAR(20) NOT NULL DEFAULT 'success',
          metadata JSONB,
          correlation_id VARCHAR(128),
          timestamp TIMESTAMP DEFAULT NOW()
        );

-- cosine_similarity, mirroring the runtime pgvector-or-fallback choice in
-- services/db/schema.ts: the pgvector-backed body where the vector type
-- exists, the portable plpgsql body everywhere else.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[]) RETURNS float8 AS $$
    BEGIN
        IF a IS NULL OR b IS NULL OR array_length(a, 1) != array_length(b, 1) THEN
            RETURN 0;
        END IF;
        RETURN 1 - (a::real[]::vector <=> b::real[]::vector);
    END;
    $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    $fn$;
  ELSE
    EXECUTE $fn$
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
    $fn$;
  END IF;
END
$do$;

-- Indexes the runtime DDL adds to tables that earlier migrations created
-- (lifted verbatim from services/db/schema.ts, services/persistentMemory.ts,
-- services/apiClientService.ts).
CREATE INDEX IF NOT EXISTS advisory_workflows_tenant_idx ON advisory_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS advisory_workflows_status_idx ON advisory_workflows(status);
CREATE INDEX IF NOT EXISTS advisory_workflows_category_idx ON advisory_workflows(category);
CREATE INDEX IF NOT EXISTS advisory_workflows_created_by_idx ON advisory_workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_category ON agent_memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_client_period ON api_usage_events(client_id, created_at);

-- Named unique constraint kept in step with emailWorkflowService.initialize().
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_name_unique') THEN
    ALTER TABLE email_templates ADD CONSTRAINT email_templates_name_unique UNIQUE (name);
  END IF;
END $$;


-- lifted verbatim from services/agentTelemetry.ts and services/db/schema.ts
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON agent_telemetry(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON agent_telemetry(timestamp DESC);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_revoked_idx ON user_sessions(user_id, is_revoked);
