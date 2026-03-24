-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "notification_sent" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "low_satisfaction_alert_sent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "farmers" ADD COLUMN     "assigned_officer_id" UUID,
ADD COLUMN     "assignment_notification_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_active" BOOLEAN DEFAULT true,
ADD COLUMN     "location_lat" DECIMAL(10,8),
ADD COLUMN     "location_lng" DECIMAL(11,8),
ADD COLUMN     "vital_score" DECIMAL(5,2),
ADD COLUMN     "yield_history" JSONB;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "stripe_price_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "expiry_notification_sent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "follow_up_reminder_sent" BOOLEAN DEFAULT false,
ADD COLUMN     "overdue_alert_sent" BOOLEAN DEFAULT false,
ADD COLUMN     "reminder_sent" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "channel" VARCHAR(50) DEFAULT 'in_app',
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "created_by" UUID,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(6),
    "permissions" TEXT[] DEFAULT ARRAY['view']::TEXT[],
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_accesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_id" UUID NOT NULL,
    "accessed_by" VARCHAR(255),
    "accessed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_key" ON "shares"("token");

-- AddForeignKey
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_accesses" ADD CONSTRAINT "share_accesses_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
