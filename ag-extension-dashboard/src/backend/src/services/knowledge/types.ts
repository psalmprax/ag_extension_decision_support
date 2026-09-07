/** Shared lightweight types for the knowledge pipeline (no runtime code). */
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import type { SearchResult } from '@/services/vectorService';

export interface KnowledgeAttachment {
    type: 'image' | 'file' | 'audio';
    data: string;
    mimeType?: string;
}

export interface ReasonOptions {
    preferredProvider?: string;
}

export interface AskOptions extends ReasonOptions {
    bypassCache?: boolean;
}

/** Visual-asset payload shared by reasoning results and the extractive fallback. */
export type AnswerVisuals = NonNullable<ReasoningResult['visuals']>;

/** Final answer payload returned by askQuestion (and its fallback paths). */
export type FinalAnswer = ReasoningResult & { cached: boolean; contextUsed: SearchResult[] };

/** Cache-layer answer payload (before `cached` flag is attached). */
export interface CachedAnswer {
    reasoning: string;
    answer: string;
    contextUsed: SearchResult[];
    visuals?: AnswerVisuals;
}

/** One de-duplicated search-history entry (mirrors the SQL aliases). */
export interface SearchHistoryEntry {
    id: string;
    queryText: string;
    answer: string | null;
    reasoning: string | null;
    visuals: unknown;
    category: string | null;
    crop: string | null;
    createdAt: string;
}

/** Aggregated search statistics for visuals. */
export interface SearchStats {
    crops: Array<{ crop: string | null; count: string | number }>;
    categories: Array<{ category: string | null; count: string | number }>;
    totalQueries: number;
    cachedQueries: number;
    totalArticles?: number;
    embeddedArticles?: number;
}
