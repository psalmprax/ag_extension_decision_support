import { z } from 'zod'

// Common validation patterns
export const phoneRegex = /^\+?[1-9]\d{1,14}$/
export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Auth schemas
export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
})

// Farmer schemas
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
})

export const farmerUpdateSchema = farmerSchema.partial()

// Visit schemas
export const visitSchema = z.object({
    farmerId: z.string().regex(uuidRegex, 'Invalid farmer ID'),
    farmerName: z.string().min(1, 'Farmer name is required'),
    scheduledDate: z.string().datetime({ message: 'Invalid date format' }),
    notes: z.string().max(1000).optional(),
})

export const visitUpdateSchema = z.object({
    status: z.enum(['pending', 'completed', 'cancelled']).optional(),
    notes: z.string().max(1000).optional(),
    scheduledDate: z.string().datetime().optional(),
})

// Chat schemas
export const messageSchema = z.object({
    conversationId: z.string().regex(uuidRegex).optional(),
    message: z.string().min(1, 'Message is required').max(5000),
    farmerId: z.string().regex(uuidRegex).optional(),
    mode: z.enum(['advisory', 'farmer']).optional(),
})

// Knowledge base schemas
export const articleSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().min(1, 'Content is required'),
    category: z.string().min(1, 'Category is required'),
    tags: z.array(z.string()).optional(),
    language: z.string().optional(),
})

// Analytics schemas
export const dateRangeSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
})

// User schemas
export const userUpdateSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    phone: z.string().regex(phoneRegex).optional(),
})

// Report schemas
export const reportGenerationSchema = z.object({
    type: z.enum(['visits', 'farmers', 'performance', 'impact']),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    format: z.enum(['json', 'pdf', 'csv']).default('json'),
})

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type FarmerInput = z.infer<typeof farmerSchema>
export type FarmerUpdateInput = z.infer<typeof farmerUpdateSchema>
export type VisitInput = z.infer<typeof visitSchema>
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type ArticleInput = z.infer<typeof articleSchema>
export type DateRangeInput = z.infer<typeof dateRangeSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type ReportGenerationInput = z.infer<typeof reportGenerationSchema>

// Validation helper
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean
    data?: T
    errors?: Record<string, string>
} {
    const result = schema.safeParse(data)

    if (result.success) {
        return { success: true, data: result.data }
    }

    const errors: Record<string, string> = {}
    result.error.issues.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
    })

    return { success: false, errors }
}
