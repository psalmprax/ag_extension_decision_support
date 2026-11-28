-- Alerts that reach farmers, not only staff.
-- notify_farmers: set by the system for factual alerts (forecast severe weather) and by an
--   officer who chooses it; never by the AI alert tool, whose text carries its own advice.
-- dedupe_key: one weather alert per forecast cell and day, however often the check runs.
-- expires_at: when the alert stops being worth sending (a forecast day that has passed).
ALTER TABLE "alerts" ADD COLUMN "notify_farmers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "alerts" ADD COLUMN "dedupe_key" VARCHAR(120);
ALTER TABLE "alerts" ADD COLUMN "expires_at" TIMESTAMP(6);
-- details: the facts a farmer notice is built from (forecast day, condition, rain; the officer's name).
ALTER TABLE "alerts" ADD COLUMN "details" JSONB;
CREATE UNIQUE INDEX "alerts_dedupe_key_key" ON "alerts"("dedupe_key");

-- One row per alert and farmer, written before the send: a farmer gets an alert at most once,
-- and the rows give the daily cap its count.
CREATE TABLE "alert_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alert_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "outcome" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alert_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alert_deliveries_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "alert_deliveries_alert_id_farmer_id_key" ON "alert_deliveries"("alert_id", "farmer_id");
CREATE INDEX "alert_deliveries_farmer_id_created_at_idx" ON "alert_deliveries"("farmer_id", "created_at");
