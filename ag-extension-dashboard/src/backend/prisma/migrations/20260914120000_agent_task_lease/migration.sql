-- Lease-based agent task claiming: allows multiple replicas to coordinate
-- task execution through the DB instead of duplicating work.
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS locked_by VARCHAR(160);
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP(6);
