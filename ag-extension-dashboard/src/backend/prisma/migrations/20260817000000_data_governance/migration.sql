-- Gap Wave B: tenant ownership and data governance.
-- Existing deployments may provision the same objects through databaseService.createTables.
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

INSERT INTO tenants (id, name, region)
SELECT gen_random_uuid(), 'Default tenant', NULL
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

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE farmers DROP CONSTRAINT IF EXISTS farmers_tenant_id_fkey;
ALTER TABLE farmers ADD CONSTRAINT farmers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

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

ALTER TABLE shares ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
UPDATE shares s
SET tenant_id = u.tenant_id
FROM users u
WHERE s.tenant_id IS NULL AND s.created_by = u.id;
CREATE INDEX IF NOT EXISTS shares_tenant_id_idx ON shares(tenant_id);

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
