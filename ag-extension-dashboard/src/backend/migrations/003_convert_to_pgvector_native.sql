-- ============================================================
-- Migration 003: Convert embedding columns to pgvector native type
-- ============================================================
-- Converts float8[] to vector(1536) for O(log n) similarity search
-- with IVFFlat index instead of O(n) sequential scan.

BEGIN;

-- 1. Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Convert knowledge_articles.embedding from float8[] to vector(1536)
-- This is safe to run on existing data — pgvector handles the cast
ALTER TABLE knowledge_articles
    ALTER COLUMN embedding TYPE vector(1536)
    USING embedding::real[]::vector;

-- 3. Convert search_cache.embedding from float8[] to vector(1536)
ALTER TABLE search_cache
    ALTER COLUMN embedding TYPE vector(1536)
    USING embedding::real[]::vector;

-- 4. Create IVFFlat index for approximate nearest neighbor search
-- lists=100 is good for up to ~100k vectors; increase for larger datasets
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_embedding_ivfflat
    ON knowledge_articles USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_search_cache_embedding_ivfflat
    ON search_cache USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. Update cosine_similarity to work with native vector type
-- Uses the <=> (cosine distance) operator directly — no casting needed
CREATE OR REPLACE FUNCTION cosine_similarity(a float8[], b float8[]) RETURNS float8 AS $$
BEGIN
    IF a IS NULL OR b IS NULL THEN
        RETURN 0;
    END IF;
    -- Cast float8[] inputs to vector for native pgvector operator
    RETURN 1 - (a::real[]::vector <=> b::real[]::vector);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- 6. Add optimized function that takes vector type directly (no casting)
CREATE OR REPLACE FUNCTION cosine_similarity_vec(a vector, b vector) RETURNS float8 AS $$
BEGIN
    IF a IS NULL OR b IS NULL THEN
        RETURN 0;
    END IF;
    RETURN 1 - (a <=> b);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMIT;
