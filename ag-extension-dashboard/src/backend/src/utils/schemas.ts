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
