/**
 * Shared API contract — farmers (`/api/v1/farmers`).
 * The desktop list/create/update payload shape (the backend's `farmerData`
 * mapping). The `farmerDetailSchema` extends it with detail-only fields.
 */
import { z } from 'zod';

// Optional fields are intentionally NOT nullable: the dashboard's de-facto
// contract treats absent values as `undefined`, and all existing UI code
// (forms, lists, charts) is typed against that. Backend nulls are tolerated
// at runtime by the same optionality.
export const farmerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  region: z.string().optional(),
  village: z.string().optional(),
  crops: z.array(z.string()).optional(),
  farmSize: z.number().optional(),
  vitalScore: z.number().optional(),
  yieldHistory: z
    .array(z.object({ month: z.string(), yield: z.number() }))
    .optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  languagePreference: z.string().optional(),
});

export const farmerDetailSchema = farmerSchema.extend({
  email: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  lastVisit: z.string().nullable().optional(),
});

export const farmerListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    farmers: z.array(farmerSchema),
    total: z.number(),
  }),
});

export type Farmer = z.infer<typeof farmerSchema>;
export type FarmerDetail = z.infer<typeof farmerDetailSchema>;
export type FarmerListResponse = z.infer<typeof farmerListResponseSchema>;
