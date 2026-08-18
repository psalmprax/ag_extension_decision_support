/**
 * Shared API contract — low-level building blocks.
 *
 * These helpers are kept deliberately version-agnostic so the schemas run
 * identically on zod v3 (backend) and zod v4 (frontend). Avoid zod APIs that
 * were removed or renamed in v4 (e.g. z.string().email(), .nonempty()).
 */
import { z } from 'zod';

/**
 * Canonical UUID regex — matches Postgres `uuid` columns.
 * The fields/farmers tables use UUIDs; non-UUID ids (e.g. demo-farmer-1)
 * must never reach the database.
 */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'must be a valid UUID'
  );

/** ISO-8601 date-time string (loose — format kept simple for cross-version compat). */
export const isoStringSchema = z.string();

/** ISO-8601 date-time string or null. */
export const nullableIsoStringSchema = z.string().nullable();

/** Common error envelope returned by every endpoint on failure. */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  errorCode: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
