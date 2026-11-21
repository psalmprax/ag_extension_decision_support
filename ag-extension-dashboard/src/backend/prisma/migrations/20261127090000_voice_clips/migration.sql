-- Recordings of a person reading the voice line's prompts and advisories, per language,
-- and outbound calls that play an advisory to farmers.
CREATE TABLE IF NOT EXISTS "voice_clips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "transcript" TEXT,
    "upload_id" UUID NOT NULL,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_clips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "voice_clips_upload_id_fkey" FOREIGN KEY ("upload_id")
        REFERENCES "upload_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voice_clips_recorded_by_fkey" FOREIGN KEY ("recorded_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "voice_clips_key_language_key" ON "voice_clips"("key", "language");
CREATE INDEX IF NOT EXISTS "voice_clips_upload_id_idx" ON "voice_clips"("upload_id");
CREATE INDEX IF NOT EXISTS "voice_clips_recorded_by_idx" ON "voice_clips"("recorded_by");

CREATE TABLE IF NOT EXISTS "voice_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clip_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(6),
    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "voice_calls_status_check" CHECK ("status" IN ('queued', 'played', 'failed')),
    CONSTRAINT "voice_calls_clip_id_fkey" FOREIGN KEY ("clip_id")
        REFERENCES "voice_clips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voice_calls_farmer_id_fkey" FOREIGN KEY ("farmer_id")
        REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voice_calls_requested_by_fkey" FOREIGN KEY ("requested_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "voice_calls_phone_created_at_idx" ON "voice_calls"("phone", "created_at");
CREATE INDEX IF NOT EXISTS "voice_calls_clip_id_idx" ON "voice_calls"("clip_id");
CREATE INDEX IF NOT EXISTS "voice_calls_farmer_id_idx" ON "voice_calls"("farmer_id");
CREATE INDEX IF NOT EXISTS "voice_calls_requested_by_idx" ON "voice_calls"("requested_by");
