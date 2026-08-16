CREATE TABLE "offline_mutations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mutation_key" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(20) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_mutations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "offline_mutations_user_key_unique" UNIQUE ("user_id", "mutation_key")
);

CREATE INDEX "offline_mutations_user_id_idx" ON "offline_mutations"("user_id");
CREATE INDEX "offline_mutations_status_idx" ON "offline_mutations"("status");

ALTER TABLE "offline_mutations"
  ADD CONSTRAINT "offline_mutations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
