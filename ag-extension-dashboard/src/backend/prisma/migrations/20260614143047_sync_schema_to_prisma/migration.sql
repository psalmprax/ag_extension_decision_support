-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "alert_notification_sent" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "farmers" ADD COLUMN     "ai_confidence" DECIMAL(5,2),
ADD COLUMN     "ph_level" DECIMAL(4,2),
ADD COLUMN     "soil_moisture" DECIMAL(5,2),
ADD COLUMN     "temperature" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reset_token" VARCHAR(255),
ADD COLUMN     "reset_token_expires" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "scheduled_sms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_sms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "plan_id" UUID NOT NULL,
    "is_redeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemed_by" UUID,
    "redeemed_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "transaction_id" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "verified_at" TIMESTAMP(6),
    "verified_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_searches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT,
    "reasoning" TEXT,
    "visuals" JSONB,
    "category" TEXT,
    "crop" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "query_text" TEXT NOT NULL,
    "normalized_query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "visuals" JSONB,
    "context_used" JSONB NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "monthly_quota" INTEGER NOT NULL DEFAULT 1000,
    "current_period_start" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "key_prefix" VARCHAR(80) NOT NULL,
    "key_hash" VARCHAR(128) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "api_key_id" UUID,
    "endpoint" VARCHAR(160) NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" UUID,
    "recipient_phone" VARCHAR(20) NOT NULL,
    "farmer_id" UUID,
    "message" TEXT NOT NULL,
    "status" VARCHAR(50) DEFAULT 'pending',
    "provider" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tropical_knowledge_sources" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "license" TEXT,
    "url" TEXT NOT NULL,
    "sync_mode" VARCHAR(50) NOT NULL,
    "topics" TEXT[],
    "crops" TEXT[],
    "regions" TEXT[],
    "description" TEXT,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tropical_knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farmer_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "area_hectares" DECIMAL(10,2),
    "soil_type" VARCHAR(50),
    "soil_ph" DECIMAL(4,2),
    "boundary_coordinates" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "field_id" UUID NOT NULL,
    "crop_name" VARCHAR(100) NOT NULL,
    "variety" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'planned',
    "planting_date" TIMESTAMP(6),
    "expected_harvest_date" TIMESTAMP(6),
    "actual_harvest_date" TIMESTAMP(6),
    "yield_kg" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_relationships" (
    "id" SERIAL NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "article_id" UUID,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_submissions_transaction_id_key" ON "transaction_submissions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_cache_normalized_query_key" ON "search_cache"("normalized_query");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "fields_farmer_id_idx" ON "fields"("farmer_id");

-- CreateIndex
CREATE INDEX "crop_cycles_field_id_idx" ON "crop_cycles"("field_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_article_id_idx" ON "knowledge_chunks"("article_id");

-- CreateIndex
CREATE INDEX "knowledge_entities_entity_type_idx" ON "knowledge_entities"("entity_type");

-- CreateIndex
CREATE INDEX "knowledge_relationships_source_id_idx" ON "knowledge_relationships"("source_id");

-- CreateIndex
CREATE INDEX "knowledge_relationships_target_id_idx" ON "knowledge_relationships"("target_id");

-- CreateIndex
CREATE INDEX "knowledge_relationships_relation_type_idx" ON "knowledge_relationships"("relation_type");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_relationships_source_id_target_id_relation_type_a_key" ON "knowledge_relationships"("source_id", "target_id", "relation_type", "article_id");

-- CreateIndex
CREATE INDEX "alerts_is_active_idx" ON "alerts"("is_active");

-- CreateIndex
CREATE INDEX "alerts_type_idx" ON "alerts"("type");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_farmer_id_idx" ON "analytics_events"("farmer_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "farmers_assigned_officer_id_idx" ON "farmers"("assigned_officer_id");

-- CreateIndex
CREATE INDEX "farmers_region_idx" ON "farmers"("region");

-- CreateIndex
CREATE INDEX "farmers_user_id_idx" ON "farmers"("user_id");

-- CreateIndex
CREATE INDEX "knowledge_articles_category_idx" ON "knowledge_articles"("category");

-- CreateIndex
CREATE INDEX "knowledge_articles_tags_idx" ON "knowledge_articles" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "knowledge_articles_crops_idx" ON "knowledge_articles" USING GIN ("crops");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "reports_generated_by_idx" ON "reports"("generated_by");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "shares_entity_type_entity_id_idx" ON "shares"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "visits_farmer_id_idx" ON "visits"("farmer_id");

-- CreateIndex
CREATE INDEX "visits_officer_id_idx" ON "visits"("officer_id");

-- CreateIndex
CREATE INDEX "visits_status_idx" ON "visits"("status");

-- AddForeignKey
ALTER TABLE "scheduled_sms" ADD CONSTRAINT "scheduled_sms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_submissions" ADD CONSTRAINT "transaction_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_submissions" ADD CONSTRAINT "transaction_submissions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_searches" ADD CONSTRAINT "knowledge_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_events" ADD CONSTRAINT "api_usage_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_events" ADD CONSTRAINT "api_usage_events_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_cycles" ADD CONSTRAINT "crop_cycles_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relationships" ADD CONSTRAINT "knowledge_relationships_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relationships" ADD CONSTRAINT "knowledge_relationships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "knowledge_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relationships" ADD CONSTRAINT "knowledge_relationships_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
