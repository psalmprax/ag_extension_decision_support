-- Phase 2 feature tables: farm plan milestones, soil lab imports

ALTER TABLE "crop_cycles"
  ADD COLUMN IF NOT EXISTS "plan_json" JSONB,
  ADD COLUMN IF NOT EXISTS "plan_generated_at" TIMESTAMP(6);

CREATE TABLE "crop_cycle_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "crop_cycle_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'input',
    "due_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(6),
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_cycle_milestones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crop_cycle_milestones_status_check" CHECK ("status" IN ('pending','done','missed')),
    CONSTRAINT "crop_cycle_milestones_cycle_fkey" FOREIGN KEY ("crop_cycle_id") REFERENCES "crop_cycles"("id") ON DELETE CASCADE
);

CREATE INDEX "crop_cycle_milestones_cycle_idx" ON "crop_cycle_milestones"("crop_cycle_id", "due_date");

CREATE TABLE "soil_lab_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmer_id" UUID,
    "field_id" UUID,
    "lab_name" VARCHAR(150),
    "sample_ref" VARCHAR(100),
    "ph" DECIMAL(4,2),
    "nitrogen_ppm" DECIMAL(8,2),
    "phosphorus_ppm" DECIMAL(8,2),
    "potassium_ppm" DECIMAL(8,2),
    "organic_matter_pct" DECIMAL(5,2),
    "raw" JSONB,
    "tested_at" TIMESTAMP(6),
    "imported_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soil_lab_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "soil_lab_results_farmer_idx" ON "soil_lab_results"("farmer_id", "tested_at");
ALTER TABLE "soil_lab_results"
  ADD CONSTRAINT "soil_lab_results_farmer_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL;
ALTER TABLE "soil_lab_results"
  ADD CONSTRAINT "soil_lab_results_field_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE SET NULL;
