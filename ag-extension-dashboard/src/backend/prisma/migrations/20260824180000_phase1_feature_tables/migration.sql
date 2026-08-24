-- Phase 1 feature tables: efficacy loop, advisory engine, outbreak intelligence

CREATE TABLE "recommendation_outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" UUID,
    "farmer_id" UUID,
    "officer_id" UUID,
    "crop" VARCHAR(100) NOT NULL,
    "advice_category" VARCHAR(100) NOT NULL,
    "advice_summary" TEXT NOT NULL,
    "outcome" VARCHAR(30) NOT NULL,
    "follow_up_photo_id" UUID,
    "officer_notes" TEXT,
    "measured_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_outcomes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recommendation_outcomes_outcome_check" CHECK ("outcome" IN ('resolved','improved','unresolved','worsened','lost_to_followup'))
);

CREATE INDEX "recommendation_outcomes_visit_id_idx" ON "recommendation_outcomes"("visit_id");
CREATE INDEX "recommendation_outcomes_farmer_id_idx" ON "recommendation_outcomes"("farmer_id");
CREATE INDEX "recommendation_outcomes_officer_measured_idx" ON "recommendation_outcomes"("officer_id", "measured_at");
CREATE INDEX "recommendation_outcomes_crop_category_idx" ON "recommendation_outcomes"("crop", "advice_category");

ALTER TABLE "recommendation_outcomes"
  ADD CONSTRAINT "recommendation_outcomes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recommendation_outcomes"
  ADD CONSTRAINT "recommendation_outcomes_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "advisory_preferences" (
    "farmer_id" UUID NOT NULL,
    "opt_in" BOOLEAN NOT NULL DEFAULT true,
    "channels" VARCHAR(20)[] DEFAULT '{whatsapp}',
    "categories" VARCHAR(40)[] DEFAULT '{planting_window,dry_spell_warning,faw_degree_day,late_blight_risk}',
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisory_preferences_pkey" PRIMARY KEY ("farmer_id")
);

ALTER TABLE "advisory_preferences"
  ADD CONSTRAINT "advisory_preferences_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "advisory_dispatches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_key" VARCHAR(60) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "audience_count" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "dedupe_hash" CHAR(64) NOT NULL,
    "dispatched_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisory_dispatches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "advisory_dispatches_dedupe_unique" UNIQUE ("dedupe_hash")
);

CREATE INDEX "advisory_dispatches_rule_district_idx" ON "advisory_dispatches"("rule_key", "district", "dispatched_at");

CREATE TABLE "diagnosis_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmer_id" UUID,
    "district" VARCHAR(100),
    "crop" VARCHAR(100) NOT NULL,
    "disease_label" VARCHAR(150) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" VARCHAR(30) NOT NULL DEFAULT 'extension_tool',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnosis_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diagnosis_events_district_crop_idx" ON "diagnosis_events"("district", "crop", "created_at");
CREATE INDEX "diagnosis_events_created_at_idx" ON "diagnosis_events"("created_at");

ALTER TABLE "diagnosis_events"
  ADD CONSTRAINT "diagnosis_events_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "district_adjacency" (
    "district" VARCHAR(100) NOT NULL,
    "adjacent_district" VARCHAR(100) NOT NULL,

    CONSTRAINT "district_adjacency_pkey" PRIMARY KEY ("district", "adjacent_district")
);
