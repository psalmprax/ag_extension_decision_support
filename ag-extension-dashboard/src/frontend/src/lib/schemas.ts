import { z } from 'zod';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

// Client-side validation for the farmer registration form. The API validates
// every request itself (ag-extension-shared contract); this only gives early
// field-level feedback.
export const farmerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  location: z.string().min(1, 'Location is required').max(200),
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  languagePreference: z.string().optional(),
  crops: z.array(z.string()).optional(),
  farmSize: z.number().nonnegative().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  vitalScore: z.number().min(0).max(100).optional(),
  yieldHistory: z.any().optional(),
});

export type FarmerInput = z.infer<typeof farmerSchema>;
