/**
 * Shared API contract — fields & crop cycles (`/api/v1/fields`).
 *
 * These shapes mirror the Prisma `Field` / `CropCycle` models returned by the
 * backend fields route. `id`/`farmerId` are plain strings in the entity
 * schema (matches Prisma + local demo data), while `createFieldSchema`
 * enforces the canonical UUID rule on `farmerId` at the write boundary — the
 * exact guard that prevented the demo-farmer-1 → 500 production incident.
 */
import { z } from 'zod';
import { uuidSchema } from './helpers';
import { boundaryMethodSchema, boundaryPointsSchema } from './fieldBoundary';

export const cropCycleStatusSchema = z.enum([
  'planned',
  'growing',
  'harvested',
  'failed',
]);

export const cropCycleSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  cropName: z.string(),
  variety: z.string().nullable().optional(),
  status: cropCycleStatusSchema,
  plantingDate: z.string().nullable().optional(),
  expectedHarvestDate: z.string().nullable().optional(),
  actualHarvestDate: z.string().nullable().optional(),
  yieldKg: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const fieldSchema = z.object({
  id: z.string(),
  farmerId: z.string(),
  name: z.string(),
  areaHectares: z.number(),
  soilType: z.string().nullable().optional(),
  soilPh: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  /** Corners of the field's edge in order; the area is worked out from them. */
  boundaryCoordinates: boundaryPointsSchema.nullable().optional(),
  boundaryMethod: boundaryMethodSchema.nullable().optional(),
  /** Typical GPS error of a walked boundary, in metres. */
  boundaryAccuracyM: z.number().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cropCycles: z.array(cropCycleSchema).optional(),
});

/**
 * The parts of a field a person can set. With a boundary, the area and location come from the
 * boundary; null clears it.
 */
export const fieldWriteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  areaHectares: z.number().positive().max(100_000),
  soilType: z.string().max(50).nullable().optional(),
  soilPh: z.number().min(0).max(14).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  boundaryCoordinates: boundaryPointsSchema.nullable().optional(),
  boundaryMethod: boundaryMethodSchema.nullable().optional(),
  boundaryAccuracyM: z.number().positive().max(1000).nullable().optional(),
});

/** POST /api/v1/fields — write contract (camelCase, same as the frontend sends). */
export const createFieldSchema = fieldWriteSchema.extend({ farmerId: uuidSchema.optional() });

/** PUT /api/v1/fields/:id */
export const updateFieldSchema = fieldWriteSchema.partial();

export const fieldListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(fieldSchema),
  total: z.number(),
});

export type CropCycleStatus = z.infer<typeof cropCycleStatusSchema>;
export type CropCycle = z.infer<typeof cropCycleSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type CreateField = z.infer<typeof createFieldSchema>;
export type UpdateField = z.infer<typeof updateFieldSchema>;
export type FieldListResponse = z.infer<typeof fieldListResponseSchema>;
