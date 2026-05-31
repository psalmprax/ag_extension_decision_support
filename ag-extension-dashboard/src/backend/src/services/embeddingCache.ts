import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

/**
 * In-memory LRU cache for query embeddings.
 * Prevents the same query text from being embedded 3x per askQuestion() call
 * (semantic cache, vector search, cache save).
 *
 * TTL: 10 minutes. Max 1000 entries.
 */

interface CacheEntry {
    embedding: number[];
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 1000;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function evict(): void {
    if (cache.size <= MAX_ENTRIES) return;
    // Remove oldest entries
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(MAX_ENTRIES * 0.2));
    for (const [key] of toRemove) {
        cache.delete(key);
    }
}

/**
 * Get embedding for text, using cache if available.
 * Falls back to AIRouter on cache miss.
 */
export async function getEmbedding(text: string): Promise<number[]> {
    const key = text.trim().toLowerCase();
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && (now - cached.timestamp) < TTL_MS) {
        return cached.embedding;
    }

    // Cache miss — generate embedding
    const result = await AIRouter.routeRequest('embed', { text });
    const embedding = result.embedding;

    // Store in cache
    cache.set(key, { embedding, timestamp: now });
    evict();

    return embedding;
}

/**
 * Get cache stats for monitoring.
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
    return { size: cache.size, maxSize: MAX_ENTRIES };
}
