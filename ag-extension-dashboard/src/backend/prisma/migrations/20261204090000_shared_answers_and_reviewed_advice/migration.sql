-- Answers shared between users who ask the same question for the same place and language
-- (src/services/knowledge/sharedAnswerCache.ts). Only answers written from cited sources are
-- kept, under a hash of the question and its context: no user id and no question text.
CREATE TABLE "shared_answer_cache" (
    "scope_key" VARCHAR(64) NOT NULL,
    "answer" JSONB NOT NULL,
    "source_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "sources_fingerprint" VARCHAR(32) NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_hit_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "shared_answer_cache_pkey" PRIMARY KEY ("scope_key")
);

CREATE INDEX "shared_answer_cache_expires_at_idx" ON "shared_answer_cache"("expires_at");

-- How an answer's knowledge-base sources looked when it was saved: a hash over each article's
-- title, text, tags, regions and crops. An article since edited, sent back for review or
-- deleted changes the hash, and the saved answer is not reused.
CREATE FUNCTION "knowledge_sources_fingerprint"(article_ids UUID[]) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT md5(COALESCE(string_agg(
           a.id::text || ':' || md5(concat_ws(E'\n', a.title, a.content,
             COALESCE(array_to_string(a.tags, ','), ''),
             COALESCE(array_to_string(a.regions, ','), ''),
             COALESCE(array_to_string(a.crops, ','), ''))),
           ',' ORDER BY a.id), ''))
  FROM knowledge_articles a
  WHERE a.id = ANY(article_ids)
$$;

-- Approved advice added to the knowledge base from the review queue
-- (src/services/knowledge/reviewedAnswers.ts).
ALTER TABLE "recommendation_reviews" ADD COLUMN "knowledge_article_id" UUID;

CREATE INDEX "recommendation_reviews_knowledge_article_id_idx" ON "recommendation_reviews"("knowledge_article_id");

ALTER TABLE "recommendation_reviews" ADD CONSTRAINT "recommendation_reviews_knowledge_article_id_fkey" FOREIGN KEY ("knowledge_article_id") REFERENCES "knowledge_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
