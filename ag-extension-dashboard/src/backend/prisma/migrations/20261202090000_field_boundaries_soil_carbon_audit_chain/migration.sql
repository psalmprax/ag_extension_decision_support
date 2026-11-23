-- Fields keep the location people enter (it was not stored before) and how their boundary was
-- mapped. The area holds four decimals so a small plot measured from its boundary keeps its size.
ALTER TABLE "fields" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9,6);
ALTER TABLE "fields" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9,6);
ALTER TABLE "fields" ADD COLUMN IF NOT EXISTS "boundary_method" VARCHAR(10);
ALTER TABLE "fields" ADD COLUMN IF NOT EXISTS "boundary_accuracy_m" DECIMAL(6,1);
ALTER TABLE "fields" ALTER COLUMN "area_hectares" TYPE DECIMAL(12,4);

-- Labs report organic carbon, organic matter or both; keep whichever they report.
ALTER TABLE "soil_lab_results" ADD COLUMN IF NOT EXISTS "organic_carbon_pct" DECIMAL(5,2);

-- Audit entries are chained: each stores the hash of the one before, so a changed or removed
-- entry shows up when the chain is checked. Entries written before this migration stay unchained.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "chain_seq" BIGINT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "prev_hash" CHAR(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entry_hash" CHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_chain_seq_key" ON "audit_logs"("chain_seq");
