/**
 * Shared type definitions for KnowledgeBase visual data.
 *
 * These shapes are used by:
 *   - {@link ReasoningVisuals} (renderer — authoritative props)
 *   - {@link AIResult} (container which forwards `{ visuals }` to the renderer)
 *   - the `Result` from `/api/knowledgeService` (data source)
 *
 * Keep this file free of runtime dependencies so it can be imported from
 * any layer without pulling in framer-motion, recharts, etc.
 */

export interface KPI {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
}

export interface Chart {
    type: 'bar' | 'line' | 'pie' | 'area';
    title: string;
    data: Array<{ label: string; value: number }>;
}

export interface MediaAsset {
    url: string;
    caption?: string;
}

export interface VisualsData {
    kpis?: KPI[];
    charts?: Chart[];
    images?: MediaAsset[];
    videos?: MediaAsset[];
}

/**
 * Immutable, shared empty-state sentinel. Declared with `as const` so
 * arrays are `readonly` — consumers must treat it as read-only to
 * avoid cross-render mutation. The `satisfies VisualsData` clause
 * ensures adding a new field to `VisualsData` keeps this in sync.
 */
export const EMPTY_VISUALS = {
    kpis: [],
    charts: [],
    images: [],
    videos: [],
} as const satisfies VisualsData;
