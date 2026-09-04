/**
 * Shared API contract — visits (`/api/v1/visits`).
 */
import { z } from 'zod';
import { uuidSchema } from './helpers';

export const visitStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']);
export const visitTypeSchema = z.enum(['routine', 'follow_up', 'emergency', 'training', 'assessment']);

export const visitSchema = z.object({
  id: z.string(),
  farmerId: z.string(),
  officerId: z.string().nullable().optional(),
  visitType: visitTypeSchema.optional(),
  status: visitStatusSchema.optional(),
  scheduledAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  locationAccuracy: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  outcomes: z.string().nullable().optional(),
  followUpRequired: z.boolean().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  attachments: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createVisitSchema = z.object({
  farmerId: uuidSchema,
  visitType: visitTypeSchema.default('routine'),
  scheduledAt: z.string().nullable().optional(),
  status: visitStatusSchema.default('scheduled'),
  notes: z.string().optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  locationAccuracy: z.number().nullable().optional(),
  attachmentIds: z.array(z.string()).optional(),
  attachmentRefs: z.array(z.string()).optional(),
});

export const updateVisitSchema = z.object({
  status: visitStatusSchema.optional(),
  notes: z.string().optional(),
  outcomes: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().nullable().optional(),
});

export const visitListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(visitSchema),
  total: z.number().optional(),
});

export type Visit = z.infer<typeof visitSchema>;
export type CreateVisit = z.infer<typeof createVisitSchema>;
export type UpdateVisit = z.infer<typeof updateVisitSchema>;
export type VisitListResponse = z.infer<typeof visitListResponseSchema>;
