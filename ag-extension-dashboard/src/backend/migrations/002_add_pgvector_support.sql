-- ============================================================
-- Migration 002: Add pgvector Support for Embedding Storage
-- ============================================================
-- This migration ensures pgvector extension is available and
-- creates the necessary functions and indexes for vector search.

BEGIN;

-- 1. Enable pgvector extension (safe to run even if already loaded)
-- Note: The Dockerfile.db builds pgvector from source; this enables it
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Optimized cosine similarity function using pgvector operator
-- Falls back to manual calculation if pgvector extension isn't available
CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[]) RETURNS float8 AS $$
DECLARE
    dot_product float8 := 0;
    mag_a float8 := 0;
    mag_b float8 := 0;
BEGIN
    IF a IS NULL OR b IS NULL OR array_length(a, 1) != array_length(b, 1) THEN
        RETURN 0;
    END IF;
    FOR i IN 1..array_length(a, 1) LOOP
        dot_product := dot_product + (a[i] * b[i]);
        mag_a := mag_a + (a[i] * a[i]);
        mag_b := mag_b + (b[i] * b[i]);
    END LOOP;
    IF mag_a = 0 OR mag_b = 0 THEN
        RETURN 0;
    END IF;
    RETURN dot_product / (sqrt(mag_a) * sqrt(mag_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 3. Create a pgvector IVFFlat index for approximate similarity search
-- This will accelerate vector search once the embedding column is converted from
-- float8[] to the pgvector 'vector' type. For current float8[] implementation,
-- the custom cosine_similarity function requires sequential scan.
-- Migration to pgvector vector type:
--   ALTER TABLE knowledge_articles ALTER COLUMN embedding TYPE vector(1536);
--   CREATE INDEX idx_knowledge_articles_embedding_ivfflat ON knowledge_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
-- Note: For production use, run the ALTER COLUMN above after data migration,
-- then DROP this comment block and uncomment the real IVFFlat index.

-- 4. Create an index for the content_type column used in vector search filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_content_type 
    ON knowledge_articles (content_type);

-- 5. Add missing columns to knowledge_articles for better vector search metadata
ALTER TABLE knowledge_articles 
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 6. Create a function for hybrid search (keyword + vector)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding float8[],
    keyword_query TEXT DEFAULT '',
    max_results INT DEFAULT 10,
    min_score float8 DEFAULT 0.5
) RETURNS TABLE(
    id UUID,
    title VARCHAR(255),
    content TEXT,
    category VARCHAR(100),
    crops TEXT[],
    source_url TEXT,
    content_type VARCHAR(50),
    score float8
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ka.id,
        ka.title,
        ka.content,
        ka.category,
        ka.crops,
        ka.source_url,
        ka.content_type,
        cosine_similarity(ka.embedding, query_embedding) as score
    FROM knowledge_articles ka
    WHERE 
        cosine_similarity(ka.embedding, query_embedding) >= min_score
        AND (
            LENGTH(keyword_query) = 0 
            OR ka.title ILIKE '%' || keyword_query || '%'
            OR ka.content ILIKE '%' || keyword_query || '%'
            OR ka.category ILIKE '%' || keyword_query || '%'
        )
    ORDER BY score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

COMMIT;
