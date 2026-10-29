-- Self-reported cancellation reasons, one row per subscription, for churn reporting.
CREATE TABLE "cancellation_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellation_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cancellation_feedback_subscription_id_key" ON "cancellation_feedback"("subscription_id");
CREATE INDEX "cancellation_feedback_created_at_idx" ON "cancellation_feedback"("created_at");
CREATE INDEX "cancellation_feedback_reason_idx" ON "cancellation_feedback"("reason");

ALTER TABLE "cancellation_feedback" ADD CONSTRAINT "cancellation_feedback_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellation_feedback" ADD CONSTRAINT "cancellation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
