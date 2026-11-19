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
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  planName: z.string().optional(),
  isFree: z.boolean().optional(),
  isDemo: z.boolean().optional(),
  /** Above every tenant: the only flag that may create or promote an admin. */
  isSystemAdmin: z.boolean().optional(),
  /** Paid services the system administrator opened to this Free account. */
  serviceAccess: z.array(z.string()).optional(),
});

export const loginCredentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

/** Roles a person may pick on the public signup form. Admin and regional
 *  manager accounts are created inside the product, never self-registered. */
export const selfRegistrationRoleSchema = z.enum(['extension_officer', 'farmer']);

export const registerDataSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: selfRegistrationRoleSchema.optional(),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export const authResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    user: userSchema,
    /** Registration only: false when the chosen region has no regional manager yet. */
    managerAssigned: z.boolean().optional(),
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
export type SelfRegistrationRole = z.infer<typeof selfRegistrationRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type RegisterData = z.infer<typeof registerDataSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
