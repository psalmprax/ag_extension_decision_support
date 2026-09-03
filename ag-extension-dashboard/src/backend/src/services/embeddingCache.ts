import { AIRouter } from '@/services/aiProvider/aiProvider';
import { config } from '@/config';

/**
 * Single source of truth for embedding generation.
 *
 * - Honors AI_EMBEDDINGS_PROVIDER / AI_EMBEDDINGS_MODEL instead of whatever
 *   provider happens to be first in the generic cascade.
 * - Pins the vector length to EMBEDDING_DIMENSIONS (the pgvector column width in
 *   knowledge_articles / knowledge_chunks / search_cache). OpenAI text-embedding-3
 *   models accept a `dimensions` parameter; nomic-embed-text is natively 768.
 * - Rejects vectors of the wrong length with an actionable error instead of
 *   letting Postgres fail every upsert with "expected N dimensions".
 *
 * In-memory LRU cache (TTL 10 min, 1000 entries) prevents the same query text
 * from being embedded 3x per askQuestion() call.
 */

export const EMBEDDING_DIMENSIONS = Number.parseInt(process.env.EMBEDDING_DIMENSIONS || '768', 10);

interface CacheEntry {
    embedding: number[];
    timestamp: number;
}

// Map preserves insertion order — oldest entries are first
const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 1000;
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const EVICT_COUNT = Math.floor(MAX_ENTRIES * 0.2); // Remove 20% on eviction

function evict(): void {
    if (cache.size <= MAX_ENTRIES) return;
    const keys = cache.keys();
    for (let i = 0; i < EVICT_COUNT; i++) {
        const next = keys.next();
        if (next.done) break;
        cache.delete(next.value);
    }
}

export class EmbeddingDimensionError extends Error {
    constructor(actual: number) {
        super(
            `Embedding provider "${config.ai.embeddings.provider}" / model "${config.ai.embeddings.model}" returned ${actual} dimensions ` +
            `but the vector columns are ${EMBEDDING_DIMENSIONS}-wide. Set AI_EMBEDDINGS_MODEL to a model that supports ` +
            `${EMBEDDING_DIMENSIONS} dims (e.g. text-embedding-3-small/large with dimensions, or nomic-embed-text) ` +
            `or set EMBEDDING_DIMENSIONS and re-run the vector migration.`
        );
        this.name = 'EmbeddingDimensionError';
    }
}

export function assertEmbeddingDimensions(embedding: number[]): void {
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingDimensionError(Array.isArray(embedding) ? embedding.length : 0);
    }
}

/**
 * Get embedding for text, using cache if available.
 */
export async function getEmbedding(text: string): Promise<number[]> {
    const key = text.trim().toLowerCase();
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && (now - cached.timestamp) < TTL_MS) {
        return cached.embedding;
    }

    const result = await AIRouter.routeRequest('embed', {
        text,
        options: {
            preferredProvider: config.ai.embeddings.provider,
            model: config.ai.embeddings.model,
            dimensions: EMBEDDING_DIMENSIONS,
        },
    });
    const embedding: number[] = result?.embedding ?? [];
    assertEmbeddingDimensions(embedding);

    cache.set(key, { embedding, timestamp: now });
    evict();

    return embedding;
}

/**
 * Get cache stats for monitoring.
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return { size: cache.size, maxSize: MAX_ENTRIES };
}
