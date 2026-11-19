-- Retrieval indexes for the knowledge base.
--
-- Before this migration every vector query cast each stored array to pgvector
-- and scanned the whole table, keyword search rebuilt every article's tsvector
-- per query, and the staleness guard hashed each article's full text per row.
-- Idempotent: safe to run twice (the RAG integrity test does).

-- 1. Old boot-time DDL could convert embedding columns to pgvector's `vector`
--    type, while schema.prisma (and every write path) uses double precision[].
--    Drop the IVFFlat indexes that DDL created, then bring any converted column
--    back so all query paths see one type.
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_knowledge_articles_embedding_ivfflat;
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_ivfflat;
DROP INDEX IF EXISTS idx_search_cache_embedding_ivfflat;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['knowledge_articles', 'knowledge_chunks', 'search_cache'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
      WHERE a.attrelid = to_regclass(tbl) AND a.attname = 'embedding'
        AND NOT a.attisdropped AND t.typname = 'vector'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN embedding TYPE double precision[] USING embedding::real[]::double precision[]',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 2. Stored content hash, kept current by a trigger on every write path
--    (raw SQL, Prisma and ingestion). Chunks and graph edges carry the hash of
--    the content they were derived from; retrieval compares the two columns.
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE OR REPLACE FUNCTION knowledge_articles_set_content_hash() RETURNS trigger AS $$
BEGIN
  NEW.content_hash := encode(sha256(convert_to(NEW.content, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_articles_content_hash ON knowledge_articles;
CREATE TRIGGER knowledge_articles_content_hash
  BEFORE INSERT OR UPDATE ON knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION knowledge_articles_set_content_hash();

UPDATE knowledge_articles
SET content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')
WHERE content_hash IS DISTINCT FROM encode(sha256(convert_to(content, 'UTF8')), 'hex');

-- 3. Weighted full-text index (title above body). services/vector/vectorSql.ts
--    uses exactly this expression so the planner can match it.
CREATE INDEX IF NOT EXISTS knowledge_articles_search_tsv_idx ON knowledge_articles USING gin (
  (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(content, '')), 'B'))
);

-- 4. HNSW approximate-nearest-neighbour indexes over the 768-wide embeddings
--    (EMBEDDING_DIMENSIONS default). Expression + partial indexes keep the
--    column type unchanged; rows of another width are skipped, not rejected.
--    A deployment with a different EMBEDDING_DIMENSIONS still gets correct
--    results, through a sequential scan. Needs pgvector >= 0.5 (HNSW); without
--    it the database keeps working unindexed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
     AND EXISTS (SELECT 1 FROM pg_am WHERE amname = 'hnsw') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS knowledge_articles_embedding_hnsw_idx ON knowledge_articles
             USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE array_length(embedding, 1) = 768';
    EXECUTE 'CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx ON knowledge_chunks
             USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE array_length(embedding, 1) = 768';
    EXECUTE 'CREATE INDEX IF NOT EXISTS search_cache_embedding_hnsw_idx ON search_cache
             USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE array_length(embedding, 1) = 768';
  ELSE
    RAISE WARNING 'pgvector with HNSW is not installed: knowledge vector search stays unindexed';
  END IF;
END $$;
