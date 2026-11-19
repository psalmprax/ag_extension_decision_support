-- Service access granted by the system administrator: lets an account use one
-- paid service (for example a Free farmer messaging their officer) without
-- changing its plan. One row per account and service; revoking stamps
-- revoked_at and a later grant reuses the row (the audit log keeps the history).

CREATE TABLE IF NOT EXISTS "service_access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "service" VARCHAR(40) NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),
    "revoked_at" TIMESTAMP(6),
    "revoked_by" UUID,
    "note" VARCHAR(500),
    CONSTRAINT "service_access_grants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_access_grants_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_access_grants_revoked_by_fkey" FOREIGN KEY ("revoked_by")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_access_grants_user_id_service_key" ON "service_access_grants"("user_id", "service");
