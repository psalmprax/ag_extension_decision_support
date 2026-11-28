-- Point values read from Digital Earth Africa (one layer, one point, one date). A past month
-- never changes, so a reading is fetched once; "latest" lookups (observed_on NULL) are
-- refreshed after a day.
CREATE TABLE "satellite_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "layer" VARCHAR(60) NOT NULL,
    "point_key" VARCHAR(40) NOT NULL,
    "requested_on" VARCHAR(10) NOT NULL,
    "observed_on" VARCHAR(10),
    "bands" JSONB,
    "available_dates" JSONB,
    "fetched_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satellite_readings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_readings_layer_point_key_requested_on_key" ON "satellite_readings"("layer", "point_key", "requested_on");
