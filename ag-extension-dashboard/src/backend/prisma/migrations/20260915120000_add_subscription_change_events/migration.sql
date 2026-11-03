-- Record subscription plan changes so expansion/contraction revenue can be computed.
CREATE TABLE "subscription_change_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "from_plan_id" UUID NOT NULL,
    "to_plan_id" UUID NOT NULL,
    "from_price" DECIMAL(10,2) NOT NULL,
    "to_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_change_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_change_events_created_at_idx" ON "subscription_change_events"("created_at");

ALTER TABLE "subscription_change_events" ADD CONSTRAINT "subscription_change_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_change_events" ADD CONSTRAINT "subscription_change_events_from_plan_id_fkey" FOREIGN KEY ("from_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_change_events" ADD CONSTRAINT "subscription_change_events_to_plan_id_fkey" FOREIGN KEY ("to_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
