-- A pilot measures whether the service helps: farmers in one region are randomly split into
-- a service group and a comparison group; harvests are collected before and after the season,
-- and farmers are asked whether they followed their officer's advice.
CREATE TABLE IF NOT EXISTS "pilots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100),
    "crop" VARCHAR(80) NOT NULL,
    "season_start" DATE NOT NULL,
    "season_end" DATE NOT NULL,
    "comparison_share" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "bag_kg" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "tenant_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pilots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pilots_status_check" CHECK ("status" IN ('draft', 'running', 'closed')),
    CONSTRAINT "pilots_created_by_fkey" FOREIGN KEY ("created_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "pilots_created_by_idx" ON "pilots"("created_by");

CREATE TABLE IF NOT EXISTS "pilot_farmers" (
    "pilot_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "arm" VARCHAR(20) NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseline_kg" DOUBLE PRECISION,
    "endline_kg" DOUBLE PRECISION,
    "area_ha" DOUBLE PRECISION,
    CONSTRAINT "pilot_farmers_pkey" PRIMARY KEY ("pilot_id", "farmer_id"),
    CONSTRAINT "pilot_farmers_arm_check" CHECK ("arm" IN ('service', 'comparison')),
    CONSTRAINT "pilot_farmers_pilot_id_fkey" FOREIGN KEY ("pilot_id")
        REFERENCES "pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pilot_farmers_farmer_id_fkey" FOREIGN KEY ("farmer_id")
        REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "pilot_farmers_farmer_id_idx" ON "pilot_farmers"("farmer_id");

CREATE TABLE IF NOT EXISTS "advice_followups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pilot_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "message_id" UUID,
    "due_at" TIMESTAMP(6) NOT NULL,
    "asked_at" TIMESTAMP(6),
    "answered_at" TIMESTAMP(6),
    "answer" VARCHAR(10),
    CONSTRAINT "advice_followups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "advice_followups_answer_check" CHECK ("answer" IS NULL OR "answer" IN ('yes', 'partly', 'no')),
    CONSTRAINT "advice_followups_pilot_id_fkey" FOREIGN KEY ("pilot_id")
        REFERENCES "pilots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "advice_followups_farmer_id_fkey" FOREIGN KEY ("farmer_id")
        REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "advice_followups_pilot_id_idx" ON "advice_followups"("pilot_id");
CREATE INDEX IF NOT EXISTS "advice_followups_farmer_id_due_at_idx" ON "advice_followups"("farmer_id", "due_at");
