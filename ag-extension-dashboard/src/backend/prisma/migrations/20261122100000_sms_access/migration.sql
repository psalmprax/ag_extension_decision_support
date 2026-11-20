-- SMS-only access: the rest of a long SMS reply (MORE), officer SMS commands with a PIN,
-- short farmer numbers for officer commands, and sign-in by phone number with an SMS code.

CREATE TABLE IF NOT EXISTS "sms_continuations" (
    "phone" VARCHAR(20) NOT NULL,
    "remaining" TEXT NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sms_continuations_pkey" PRIMARY KEY ("phone")
);

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "sms_pin_hash" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "sms_pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "sms_pin_locked" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "sms_unlocked_until" TIMESTAMP(6);

CREATE TABLE IF NOT EXISTS "officer_sms_refs" (
    "officer_id" UUID NOT NULL,
    "ref" INTEGER NOT NULL,
    "farmer_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "officer_sms_refs_pkey" PRIMARY KEY ("officer_id", "ref"),
    CONSTRAINT "officer_sms_refs_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "officer_sms_refs_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "officer_sms_refs_officer_id_farmer_id_key" ON "officer_sms_refs"("officer_id", "farmer_id");

CREATE TABLE IF NOT EXISTS "phone_login_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(6),
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "phone_login_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "phone_login_codes_phone_created_at_idx" ON "phone_login_codes"("phone", "created_at");
CREATE INDEX IF NOT EXISTS "phone_login_codes_ip_address_created_at_idx" ON "phone_login_codes"("ip_address", "created_at");
