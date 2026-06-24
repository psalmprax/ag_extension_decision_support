/**
 * Shared type aliases for visit-domain models.
 *
 * The canonical `PriorityData` and `Farmer` types live in
 * `/api/visitService` and `/api/farmerService` respectively. These aliases
 * provide wider / permisive shapes (used at the component boundary where
 * the upstream could vary) so that consumer components don't need local
 * `type X = { ... }` re-declarations.
 *
 * Keep this file free of runtime dependencies so it can be imported from
 * any layer without circular imports.
 */

import type { PriorityData } from '@/api/visitService';
import type { Farmer } from '@/api/farmerService';

/**
 * Permissive view of {@link PriorityData} used as the prop type passed
 * downstream from `SatelliteInsights`. The `[key: string]: unknown`
 * index signature lets RAG / telemetry extensions attach extra fields
 * without forcing every consumer to widen.
 */
export type PriorityLike = {
    level?: string;
    score?: number;
    reasons?: string[];
    recommendedAction?: string;
    [key: string]: unknown;
} & Partial<PriorityData>;

/**
 * Permissive view of {@link Farmer} used as the prop type when
 * forwarding partially-loaded farmer records (e.g. after a fallback
 * response that supplies only `id` and a few display fields).
 */
export type FarmerLike = {
    id: string;
    firstName?: string;
    lastName?: string;
    locationLat?: number;
    locationLng?: number;
    [key: string]: unknown;
} & Partial<Farmer>;
