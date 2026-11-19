-- Officer–farmer journey: photo attachments in chat, a per-farmer progress log,
-- and the metadata column the message edit/withdraw routes already write to
-- (it was never created, so editing or withdrawing a message failed).

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "chat_message_attachments" (
    "message_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_attachments_pkey" PRIMARY KEY ("message_id", "upload_id"),
    CONSTRAINT "chat_message_attachments_message_id_fkey" FOREIGN KEY ("message_id")
        REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_message_attachments_upload_id_fkey" FOREIGN KEY ("upload_id")
        REFERENCES "upload_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "chat_message_attachments_upload_id_idx" ON "chat_message_attachments"("upload_id");

CREATE TABLE IF NOT EXISTS "farmer_progress_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmer_id" UUID NOT NULL,
    "officer_id" UUID,
    "visit_id" UUID,
    "tenant_id" UUID,
    "kind" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "details" TEXT,
    "crop" VARCHAR(100),
    "occurred_on" DATE NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "farmer_progress_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "farmer_progress_entries_kind_check"
        CHECK ("kind" IN ('success', 'failure', 'field_event', 'action', 'observation')),
    CONSTRAINT "farmer_progress_entries_farmer_id_fkey" FOREIGN KEY ("farmer_id")
        REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "farmer_progress_entries_officer_id_fkey" FOREIGN KEY ("officer_id")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "farmer_progress_entries_visit_id_fkey" FOREIGN KEY ("visit_id")
        REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "farmer_progress_entries_farmer_id_occurred_on_idx"
    ON "farmer_progress_entries"("farmer_id", "occurred_on");
CREATE INDEX IF NOT EXISTS "farmer_progress_entries_officer_id_idx" ON "farmer_progress_entries"("officer_id");
CREATE INDEX IF NOT EXISTS "farmer_progress_entries_visit_id_idx" ON "farmer_progress_entries"("visit_id");

CREATE TABLE IF NOT EXISTS "farmer_progress_attachments" (
    "entry_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "farmer_progress_attachments_pkey" PRIMARY KEY ("entry_id", "upload_id"),
    CONSTRAINT "farmer_progress_attachments_entry_id_fkey" FOREIGN KEY ("entry_id")
        REFERENCES "farmer_progress_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "farmer_progress_attachments_upload_id_fkey" FOREIGN KEY ("upload_id")
        REFERENCES "upload_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "farmer_progress_attachments_upload_id_idx" ON "farmer_progress_attachments"("upload_id");
