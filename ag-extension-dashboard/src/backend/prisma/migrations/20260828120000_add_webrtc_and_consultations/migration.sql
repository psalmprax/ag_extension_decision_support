-- Create WebRTC room + video consultation tables that were present in the
-- Prisma schema but missing from the migration history (dev flow used
-- `prisma db push`, which bypasses migration SQL). Placed before
-- 20260829130000_tenant_and_relationship_gaps, which adds the room_id
-- unique constraint/FK on video_consultations.
-- Idempotent — safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "webrtc_rooms" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "webrtc_rooms_host_id_idx" ON "webrtc_rooms"("host_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='webrtc_rooms_host_id_fkey') THEN
    ALTER TABLE "webrtc_rooms" ADD CONSTRAINT "webrtc_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "video_consultations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "farmer_id" UUID NOT NULL,
    "extension_officer_id" UUID NOT NULL,
    "scheduled_time" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "room_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "video_consultations_room_id_idx" ON "video_consultations"("room_id");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='video_consultations_farmer_id_fkey') THEN
    ALTER TABLE "video_consultations" ADD CONSTRAINT "video_consultations_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='video_consultations_extension_officer_id_fkey') THEN
    ALTER TABLE "video_consultations" ADD CONSTRAINT "video_consultations_extension_officer_id_fkey" FOREIGN KEY ("extension_officer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='video_consultations_room_id_fkey') THEN
    ALTER TABLE "video_consultations" ADD CONSTRAINT "video_consultations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "webrtc_rooms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
