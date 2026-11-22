-- The duplicate-parcel check reads farmers inside a box around a new registration.
CREATE INDEX IF NOT EXISTS "farmers_location_lat_location_lng_idx" ON "farmers"("location_lat", "location_lng");
