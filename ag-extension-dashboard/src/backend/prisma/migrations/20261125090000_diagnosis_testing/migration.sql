-- Photos labelled by an agronomist or confirmed by an officer in the field, used to test
-- photo diagnosis before a diagnosis is shown to farmers with confidence.
CREATE TABLE IF NOT EXISTS "diagnosis_test_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "upload_id" UUID NOT NULL,
    "crop" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'agronomist',
    "country" VARCHAR(100),
    "labelled_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnosis_test_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "diagnosis_test_images_source_check" CHECK ("source" IN ('agronomist', 'officer_confirmation')),
    CONSTRAINT "diagnosis_test_images_upload_id_fkey" FOREIGN KEY ("upload_id")
        REFERENCES "upload_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diagnosis_test_images_labelled_by_fkey" FOREIGN KEY ("labelled_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "diagnosis_test_images_upload_id_key" ON "diagnosis_test_images"("upload_id");
CREATE INDEX IF NOT EXISTS "diagnosis_test_images_crop_label_idx" ON "diagnosis_test_images"("crop", "label");
CREATE INDEX IF NOT EXISTS "diagnosis_test_images_labelled_by_idx" ON "diagnosis_test_images"("labelled_by");

CREATE TABLE IF NOT EXISTS "diagnosis_eval_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "started_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "model" VARCHAR(200),
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(6),
    CONSTRAINT "diagnosis_eval_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "diagnosis_eval_runs_status_check" CHECK ("status" IN ('running', 'finished', 'failed')),
    CONSTRAINT "diagnosis_eval_runs_started_by_fkey" FOREIGN KEY ("started_by")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "diagnosis_eval_runs_started_by_idx" ON "diagnosis_eval_runs"("started_by");

CREATE TABLE IF NOT EXISTS "diagnosis_eval_results" (
    "run_id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "predicted" VARCHAR(200),
    "confidence" DOUBLE PRECISION,
    "correct" BOOLEAN NOT NULL,
    CONSTRAINT "diagnosis_eval_results_pkey" PRIMARY KEY ("run_id", "image_id"),
    CONSTRAINT "diagnosis_eval_results_run_id_fkey" FOREIGN KEY ("run_id")
        REFERENCES "diagnosis_eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diagnosis_eval_results_image_id_fkey" FOREIGN KEY ("image_id")
        REFERENCES "diagnosis_test_images"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "diagnosis_eval_results_image_id_idx" ON "diagnosis_eval_results"("image_id");

-- Per crop and label, from the latest finished run: how many photos and how many right.
CREATE TABLE IF NOT EXISTS "diagnosis_class_status" (
    "crop" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "samples" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "run_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnosis_class_status_pkey" PRIMARY KEY ("crop", "label")
);
