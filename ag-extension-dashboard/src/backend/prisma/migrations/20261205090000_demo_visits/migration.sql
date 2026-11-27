-- Demo visits: who opens the demo, roughly (country, region, city, device), with the
-- IP address shortened (203.0.113.x) and never stored in full. Kept 90 days.
CREATE TABLE "demo_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country_code" VARCHAR(2),
    "region" VARCHAR(120),
    "city" VARCHAR(120),
    "ip_prefix" VARCHAR(64),
    "device" VARCHAR(100),
    "location_source" VARCHAR(10),

    CONSTRAINT "demo_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demo_visits_created_at_idx" ON "demo_visits"("created_at");
