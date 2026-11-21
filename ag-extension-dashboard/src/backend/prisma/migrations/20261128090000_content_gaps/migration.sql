-- Questions answered without a vetted guide behind them: what the content team should
-- license or write next, by crop and country.
CREATE TABLE IF NOT EXISTS "content_gaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question" VARCHAR(500) NOT NULL,
    "crop" VARCHAR(80),
    "country" VARCHAR(100),
    "language" VARCHAR(10),
    "asked_by_role" VARCHAR(30),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_gaps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "content_gaps_created_at_idx" ON "content_gaps"("created_at");
CREATE INDEX IF NOT EXISTS "content_gaps_crop_country_idx" ON "content_gaps"("crop", "country");
