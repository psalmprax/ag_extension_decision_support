import { z } from 'zod';

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
    vitalScore: z.number().min(0).max(100).optional(),
    yieldHistory: z.any().optional(),
    locationLat: z.number().optional(),
    locationLng: z.number().optional(),
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
export const memoryListSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

// Email Workflow Schemas
export const emailWorkflowListSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    status: z.enum(['active', 'paused', 'draft']).optional(),
  }),
});

// External API Schemas
export const weatherQuerySchema = z.object({
  query: z.object({
    location: z.string().min(1).max(200).optional(),
  }),
  params: z.object({
    location: z.string().min(1).max(200).optional(),
  }).optional(),
});

export const marketPriceQuerySchema = z.object({
  query: z.object({
    crop: z.string().min(1).max(100).optional(),
    region: z.string().min(1).max(100).optional(),
  }),
});

export const soilDataQuerySchema = z.object({
  query: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
});

// Analytics Schemas
export const analyticsOverviewSchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    region: z.string().optional(),
  }),
});

// Alert Schemas
export const alertListSchema = z.object({
  query: z.object({
    type: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    isActive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

// Disease Schemas
export const diseaseListSchema = z.object({
  query: z.object({
    crop: z.string().optional(),
    severity: z.string().optional(),
  }),
});

// Knowledge Schemas
export const knowledgeSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(500),
    category: z.string().optional(),
    crop: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// Report Schemas
export const reportListSchema = z.object({
  query: z.object({
    type: z.string().optional(),
    status: z.enum(['pending', 'generating', 'completed', 'failed']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// Notification Schemas
export const notificationListSchema = z.object({
  query: z.object({
    type: z.string().optional(),
    isRead: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

// Chatbot Schemas
export const chatbotMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(5000),
    conversationId: z.string().uuid().optional(),
    language: z.string().max(10).optional(),
  }),
});

// SMS Schemas
export const smsSendSchema = z.object({
  body: z.object({
    phoneNumbers: z.array(z.string().min(10).max(20)).min(1).max(100),
    message: z.string().min(1).max(1600),
    language: z.string().max(10).optional(),
  }),
});

