import { z } from 'zod';
import { passwordSchema } from './passwordPolicy';
import {
  createVisitSchema as sharedCreateVisitSchema,
  visitTypeSchema as sharedVisitTypeSchema,
  visitStatusSchema as sharedVisitStatusSchema,
} from '@/shared-api/visits';

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [extension_officer, regional_manager, admin, farmer]
 *         region:
 *           type: string
 *         phone:
 *           type: string
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 region:
 *                   type: string
 *     Farmer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         phone:
 *           type: string
 *         region:
 *           type: string
 *         village:
 *           type: string
 *         crops:
 *           type: array
 *           items:
 *             type: string
 *         farmSize:
 *           type: number
 *         vitalScore:
 *           type: number
 *         yieldHistory:
 *           type: object
 *         locationLat:
 *           type: number
 *         locationLng:
 *           type: number
 *         languagePreference:
 *           type: string
 */

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
    password: passwordSchema,
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    role: z.enum(['extension_officer', 'regional_manager', 'admin', 'farmer']).optional(),
    region: z.string().optional(),
    phone: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().email('Invalid email format') }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(32, 'Invalid token'),
    password: passwordSchema,
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().min(32, 'Invalid token') }),
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
    vitalScore: z.number().min(0).max(100).optional(),
    yieldHistory: z.any().optional(),
    locationLat: z.number().optional(),
    locationLng: z.number().optional(),
  }),
});

// Visit Schemas — the body contract is the SHARED schema (ag-extension-shared/src/api/visits.ts,
// vendored to src/shared-api). Legacy snake_case aliases are accepted and normalised so
// older clients keep working, but the canonical field names/enums are enforced.
const legacyVisitAliases = z.object({
  farmer_id: z.string().uuid().optional(),
  visit_type: z.string().optional(),
  type: z.string().optional(),
  scheduled_at: z.string().optional(),
  officerId: z.string().uuid().optional(),
});

export const createVisitSchema = z.object({
  body: legacyVisitAliases
    .merge(sharedCreateVisitSchema.partial({ farmerId: true, visitType: true, status: true }))
    .transform(b => ({
      ...b,
      farmerId: b.farmerId ?? b.farmer_id,
      visitType: (b.visitType ?? b.visit_type ?? b.type ?? 'routine') as string,
      scheduledAt: b.scheduledAt ?? b.scheduled_at,
      status: b.status ?? 'scheduled',
    }))
    .pipe(
      z.object({
        farmerId: z.string().uuid({ message: 'farmerId is required' }),
        visitType: sharedVisitTypeSchema,
        scheduledAt: z.string().datetime({ offset: true, message: 'scheduledAt must be an ISO-8601 datetime' }),
        status: sharedVisitStatusSchema,
        notes: z.string().optional(),
        locationLat: z.number().min(-90).max(90).nullable().optional(),
        locationLng: z.number().min(-180).max(180).nullable().optional(),
        locationAccuracy: z.number().min(0).nullable().optional(),
        attachmentIds: z.array(z.string().uuid()).optional(),
        attachmentRefs: z.array(z.string()).optional(),
        officerId: z.string().uuid().optional(),
      })
    ),
});

export const updateFarmerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    region: z.string().optional(),
    village: z.string().optional(),
    farmSize: z.number().positive().optional(),
    crops: z.array(z.string()).min(1).optional(),
    languagePreference: z.string().optional(),
    vitalScore: z.number().min(0).max(100).optional(),
    yieldHistory: z.any().optional(),
    locationLat: z.number().optional(),
    locationLng: z.number().optional(),
  }).strict(),
});

export const updateVisitSchema = z.object({
  body: z.object({
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    notes: z.string().optional(),
    outcomes: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    duration: z.number().positive().optional(),
  }).strict(),
});

// Telemetry Schemas
export const telemetrySummarySchema = z.object({
  query: z.object({
    hours: z.coerce.number().int().min(1).max(720).default(24),
  }),
});

export const telemetryEventsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
  }),
});

// Memory Schemas

// Email Workflow Schemas
export const emailWorkflowListSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    status: z.enum(['active', 'paused', 'draft']).optional(),
  }),
});

export const updateEmailTemplateSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject cannot be empty').max(500).optional(),
    body: z.string().min(1, 'Body cannot be empty').optional(),
    category: z.string().min(1, 'Category cannot be empty').max(100).optional(),
    variables: z.array(z.string().min(1)).optional(),
  }).strict().refine(
    data => data.subject !== undefined || data.body !== undefined || data.category !== undefined || data.variables !== undefined,
    { message: 'At least one field (subject, body, category, variables) must be provided' }
  ),
});

// External API Schemas


export const soilDataQuerySchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
});

// Analytics Schemas

// Alert Schemas

// Disease Schemas

// Knowledge Schemas

// Report Schemas

// Notification Schemas

// Chatbot Schemas

// SMS Schemas

