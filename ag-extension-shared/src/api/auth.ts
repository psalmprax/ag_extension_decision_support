/**
 * Shared API contract — auth endpoints (`/api/v1/auth/*`).
 * Canonical source of truth for the user + auth response shapes; both the
 * dashboard frontend and the backend derive their types from these schemas.
 */
import { z } from 'zod';

/** All roles understood by the backend authorization middleware. */
export const userRoleSchema = z.enum([
  'admin',
  'regional_manager',
  'extension_officer',
  'farmer',
]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: userRoleSchema,
  region: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  planName: z.string().optional(),
  isFree: z.boolean().optional(),
});

export const loginCredentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const registerDataSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().optional(),
  region: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export const authResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    user: userSchema,
  }),
  // Legacy flat fields — some older clients expect them alongside `data`.
  user: userSchema.optional(),
  token: z.string().optional(),
});

export const meResponseSchema = z.object({
  success: z.literal(true),
  data: userSchema,
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type RegisterData = z.infer<typeof registerDataSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
