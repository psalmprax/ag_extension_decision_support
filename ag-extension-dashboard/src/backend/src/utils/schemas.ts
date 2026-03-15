import { z } from 'zod';

// Auth Schemas
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    role: z.enum(['extension_officer', 'regional_manager', 'admin', 'farmer']).optional(),
    region: z.string().optional(),
    phone: z.string().optional(),
  }),
});

// Farmer Schemas
export const createFarmerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    region: z.string(),
    village: z.string(),
    farmSize: z.number().positive(),
    crops: z.array(z.string()).min(1),
    phone: z.string().optional(),
  }),
});

// Visit Schemas
export const createVisitSchema = z.object({
  body: z.object({
    farmerId: z.string().uuid(),
    visitType: z.string(),
    scheduledAt: z.string().datetime(),
    notes: z.string().optional(),
  }),
});
