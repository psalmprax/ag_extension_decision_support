/**
 * Shared API contract — upload (`/api/v1/upload`).
 */
import { z } from 'zod';
import { uuidSchema } from './helpers';

export const uploadRecordSchema = z.object({
  id: uuidSchema,
  storageKey: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  status: z.string().optional(),
  farmerId: uuidSchema.nullable().optional(),
  createdAt: z.string().optional(),
});

export const createUploadResponseSchema = z.object({
  success: z.literal(true),
  data: uploadRecordSchema,
});

export type UploadRecord = z.infer<typeof uploadRecordSchema>;
