-- Content partners (an NGO, a research institute) whose agronomists' recordings are
-- imported as a library: each recording keeps its speaker, licence and consent, is
-- transcribed, reviewed before it can ground advice, matched to farmers by language,
-- crop and region, and every send to a farmer is logged.
CREATE TABLE IF NOT EXISTS "content_partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "website" VARCHAR(300),
    "contact_email" VARCHAR(255),
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_partners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_partners_created_by_fkey" FOREIGN KEY ("created_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_partners_name_key" ON "content_partners"("name");
CREATE INDEX IF NOT EXISTS "content_partners_created_by_idx" ON "content_partners"("created_by");

-- Which organisations may use a partner's library (granted by the system administrator).
CREATE TABLE IF NOT EXISTS "content_partner_grants" (
    "partner_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_partner_grants_pkey" PRIMARY KEY ("partner_id", "tenant_id"),
    CONSTRAINT "content_partner_grants_partner_id_fkey" FOREIGN KEY ("partner_id")
        REFERENCES "content_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_partner_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_partner_grants_granted_by_fkey" FOREIGN KEY ("granted_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "content_partner_grants_tenant_id_idx" ON "content_partner_grants"("tenant_id");
CREATE INDEX IF NOT EXISTS "content_partner_grants_granted_by_idx" ON "content_partner_grants"("granted_by");

CREATE TABLE IF NOT EXISTS "partner_recordings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "speaker" VARCHAR(160) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "crops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topic" VARCHAR(80),
    "licence" VARCHAR(80) NOT NULL,
    "licence_expires_at" TIMESTAMP(6),
    "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "transcript" TEXT,
    "transcript_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "review_status" VARCHAR(20) NOT NULL DEFAULT 'pending_review',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(6),
    "knowledge_article_id" UUID,
    "imported_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_recordings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "partner_recordings_partner_id_fkey" FOREIGN KEY ("partner_id")
        REFERENCES "content_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "partner_recordings_upload_id_fkey" FOREIGN KEY ("upload_id")
        REFERENCES "upload_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "partner_recordings_imported_by_fkey" FOREIGN KEY ("imported_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "partner_recordings_partner_id_idx" ON "partner_recordings"("partner_id");
CREATE INDEX IF NOT EXISTS "partner_recordings_upload_id_idx" ON "partner_recordings"("upload_id");
CREATE INDEX IF NOT EXISTS "partner_recordings_imported_by_idx" ON "partner_recordings"("imported_by");
CREATE INDEX IF NOT EXISTS "partner_recordings_review_status_language_idx" ON "partner_recordings"("review_status", "language");
CREATE INDEX IF NOT EXISTS "partner_recordings_transcript_status_idx" ON "partner_recordings"("transcript_status");

-- Every time a recording is sent to a farmer: who sent it, how, and when.
CREATE TABLE IF NOT EXISTS "recording_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recording_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "sent_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recording_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recording_deliveries_recording_id_fkey" FOREIGN KEY ("recording_id")
        REFERENCES "partner_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recording_deliveries_farmer_id_fkey" FOREIGN KEY ("farmer_id")
        REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recording_deliveries_sent_by_fkey" FOREIGN KEY ("sent_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "recording_deliveries_recording_id_idx" ON "recording_deliveries"("recording_id");
CREATE INDEX IF NOT EXISTS "recording_deliveries_farmer_id_created_at_idx" ON "recording_deliveries"("farmer_id", "created_at");
CREATE INDEX IF NOT EXISTS "recording_deliveries_sent_by_idx" ON "recording_deliveries"("sent_by");
