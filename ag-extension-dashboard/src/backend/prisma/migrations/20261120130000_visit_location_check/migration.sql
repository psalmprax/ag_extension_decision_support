-- Verified visits: when an officer completes a visit report, the position their
-- device reported (location_lat / location_lng, already on visits), its accuracy,
-- the distance to the farm, and the outcome of the check.
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "location_accuracy_m" DECIMAL(8,1);
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "location_distance_m" INTEGER;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "location_check" VARCHAR(30);
