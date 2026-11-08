-- Existing derived records have no trustworthy source version and are excluded
-- from retrieval until they are rebuilt.

-- Repair tables that are missing even though earlier migrations are recorded as applied.
CREATE TABLE IF NOT EXISTS "knowledge_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "knowledge_relationships" (
    "id" SERIAL NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "article_id" UUID,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_relationships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_chunks_article_id_idx" ON "knowledge_chunks"("article_id");
CREATE INDEX IF NOT EXISTS "knowledge_entities_entity_type_idx" ON "knowledge_entities"("entity_type");
CREATE INDEX IF NOT EXISTS "knowledge_relationships_source_id_idx" ON "knowledge_relationships"("source_id");
CREATE INDEX IF NOT EXISTS "knowledge_relationships_target_id_idx" ON "knowledge_relationships"("target_id");
CREATE INDEX IF NOT EXISTS "knowledge_relationships_relation_type_idx" ON "knowledge_relationships"("relation_type");
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_relationships_source_id_target_id_relation_type_a_key"
    ON "knowledge_relationships"("source_id", "target_id", "relation_type", "article_id");

DELETE FROM "knowledge_relationships" AS relationship
WHERE NOT EXISTS (
    SELECT 1 FROM "knowledge_entities" AS source
    WHERE source."id" = relationship."source_id"
)
OR NOT EXISTS (
    SELECT 1 FROM "knowledge_entities" AS target
    WHERE target."id" = relationship."target_id"
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_article_id_fkey'
                   AND conrelid = '"knowledge_chunks"'::regclass) THEN
        ALTER TABLE "knowledge_chunks"
            ADD CONSTRAINT "knowledge_chunks_article_id_fkey"
            FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_relationships_source_id_fkey'
                   AND conrelid = '"knowledge_relationships"'::regclass) THEN
        ALTER TABLE "knowledge_relationships"
            ADD CONSTRAINT "knowledge_relationships_source_id_fkey"
            FOREIGN KEY ("source_id") REFERENCES "knowledge_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_relationships_target_id_fkey'
                   AND conrelid = '"knowledge_relationships"'::regclass) THEN
        ALTER TABLE "knowledge_relationships"
            ADD CONSTRAINT "knowledge_relationships_target_id_fkey"
            FOREIGN KEY ("target_id") REFERENCES "knowledge_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_relationships_article_id_fkey'
                   AND conrelid = '"knowledge_relationships"'::regclass) THEN
        ALTER TABLE "knowledge_relationships"
            ADD CONSTRAINT "knowledge_relationships_article_id_fkey"
            FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "source_content_hash" TEXT;
ALTER TABLE "knowledge_relationships" ADD COLUMN IF NOT EXISTS "source_content_hash" TEXT;
