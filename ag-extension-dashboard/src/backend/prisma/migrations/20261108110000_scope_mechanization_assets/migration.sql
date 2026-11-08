-- Existing assets have no reliable tenant attribution. Leave them unassigned
-- until an operator verifies ownership; tenant-scoped queries will exclude them.
ALTER TABLE "mechanization_assets" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "mechanization_assets"
    ADD CONSTRAINT "mechanization_assets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "mechanization_assets_tenant_id_county_asset_type_idx"
    ON "mechanization_assets"("tenant_id", "county", "asset_type");
