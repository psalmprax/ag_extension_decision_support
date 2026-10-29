-- Operator-maintained mechanization equipment registry (tractors, pumps, drones).
-- Rows are registered explicitly; nothing is seeded from the former demo directory.
CREATE TABLE "mechanization_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_type" VARCHAR(50) NOT NULL,
    "model_name" VARCHAR(200) NOT NULL,
    "owner_name" VARCHAR(200) NOT NULL,
    "owner_phone" VARCHAR(30) NOT NULL,
    "county" VARCHAR(100) NOT NULL,
    "sub_county" VARCHAR(100) NOT NULL,
    "rate_per_unit_kes" INTEGER NOT NULL,
    "rate_unit" VARCHAR(20) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mechanization_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mechanization_assets_county_asset_type_idx" ON "mechanization_assets"("county", "asset_type");
CREATE INDEX "mechanization_assets_is_available_idx" ON "mechanization_assets"("is_available");
