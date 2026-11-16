-- Why an AI recommendation was queued for human review (no_sources,
-- invalid_references, safety_boundary, farmer_request). Nullable: rows created
-- before this column, and manual submissions, carry no automatic trigger.
ALTER TABLE "recommendation_reviews" ADD COLUMN IF NOT EXISTS "trigger" VARCHAR(40);
