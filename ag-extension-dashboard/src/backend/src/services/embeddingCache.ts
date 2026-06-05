import { AIRouter } from '@/services/aiProvider/aiProvider';

/**
 * In-memory LRU cache for query embeddings.
 * Prevents the same query text from being embedded 3x per askQuestion() call
 * (semantic cache, vector search, cache save).
 *
 * TTL: 10 minutes. Max 1000 entries.
 * Uses Map's insertion order for O(1) eviction instead of O(n log n) sorting.
 */

interface CacheEntry {
    embedding: number[];
    timestamp: number;
}

// Map preserves insertion order — oldest entries are first
const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 1000;
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const EVICT_COUNT = Math.floor(MAX_ENTRIES * 0.2); // Remove 20% on eviction

/**
 * Evict oldest entries using Map's insertion order.
 * O(k) where k = EVICT_COUNT, instead of O(n log n) sorting.
 */
function evict(): void {
    if (cache.size <= MAX_ENTRIES) return;

    // Map.keys() returns entries in insertion order (oldest first)
    const keys = cache.keys();
    for (let i = 0; i < EVICT_COUNT; i++) {
        const next = keys.next();
        if (next.done) break;
        cache.delete(next.value);
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

    // Store in cache (appends to end of Map — newest last)
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
