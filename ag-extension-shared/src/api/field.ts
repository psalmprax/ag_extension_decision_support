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
  boundaryCoordinates: z.unknown().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  cropCycles: z.array(cropCycleSchema).optional(),
});

/** POST /api/v1/fields — write contract (camelCase, same as the frontend sends). */
export const createFieldSchema = z.object({
  farmerId: uuidSchema,
  name: z.string().min(1),
  areaHectares: z.number(),
  soilType: z.string().nullable().optional(),
  soilPh: z.number().nullable().optional(),
  boundaryCoordinates: z.unknown().optional(),
});

export const fieldListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(fieldSchema),
  total: z.number(),
});

export type CropCycleStatus = z.infer<typeof cropCycleStatusSchema>;
export type CropCycle = z.infer<typeof cropCycleSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type CreateField = z.infer<typeof createFieldSchema>;
export type FieldListResponse = z.infer<typeof fieldListResponseSchema>;
