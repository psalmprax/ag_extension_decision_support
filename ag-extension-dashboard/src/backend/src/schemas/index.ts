import { z } from 'zod';

/**
 * Auth validation schemas
 */
export const authSchemas = {
    login: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
    }),

    register: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().min(2, 'Name must be at least 2 characters'),
        role: z.enum(['admin', 'agent', 'farmer']).default('agent'),
    }),

    updateProfile: z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        avatar: z.string().url().optional(),
    }),
};

/**
 * Farmer validation schemas
 */
const farmerCreateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email().optional(),
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    location: z.string().min(2, 'Location is required'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    farmSize: z.number().positive().optional(),
    farmSizeUnit: z.enum(['acres', 'hectares']).default('acres'),
    cropType: z.string().optional(),
    farmingType: z.enum(['subsistence', 'commercial', 'mixed']).default('subsistence'),
    notes: z.string().optional(),
});

export const farmerSchemas = {
    create: farmerCreateSchema,
    update: farmerCreateSchema.partial(),

    query: z.object({
        search: z.string().optional(),
        location: z.string().optional(),
        farmingType: z.enum(['subsistence', 'commercial', 'mixed']).optional(),
        cropType: z.string().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
};

/**
 * Visit validation schemas
 */
export const visitSchemas = {
    create: z.object({
        farmerId: z.string().uuid('Invalid farmer ID'),
        scheduledDate: z.coerce.date(),
        purpose: z.string().min(5, 'Purpose must be at least 5 characters'),
        notes: z.string().optional(),
        location: z.string().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
    }),

    update: z.object({
        scheduledDate: z.coerce.date().optional(),
        purpose: z.string().min(5).optional(),
        status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
        notes: z.string().optional(),
        location: z.string().optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
    }),

    query: z.object({
        farmerId: z.string().uuid().optional(),
        status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
};

/**
 * Chatbot validation schemas
 */
export const chatbotSchemas = {
    sendMessage: z.object({
        message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
        sessionId: z.string().optional(),
        context: z
            .object({
                farmerId: z.string().uuid().optional(),
                location: z.string().optional(),
                cropType: z.string().optional(),
            })
            .optional(),
    }),

    feedback: z.object({
        messageId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
    }),
};

/**
 * Knowledge base validation schemas
 */
export const knowledgeSchemas = {
    createArticle: z.object({
        title: z.string().min(5, 'Title must be at least 5 characters'),
        content: z.string().min(20, 'Content must be at least 20 characters'),
        category: z.string().min(2),
        tags: z.array(z.string()).default([]),
        language: z.string().default('en'),
        isPublished: z.boolean().default(false),
    }),

    updateArticle: z.object({
        title: z.string().min(5).optional(),
        content: z.string().min(20).optional(),
        category: z.string().min(2).optional(),
        tags: z.array(z.string()).optional(),
        language: z.string().optional(),
        isPublished: z.boolean().optional(),
    }),

    query: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        tags: z.string().optional(), // comma-separated
        language: z.string().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
};

/**
 * Analytics validation schemas
 */
export const analyticsSchemas = {
    dashboard: z.object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
    }),

    report: z.object({
        type: z.enum(['visits', 'farmers', 'performance', 'crops']),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        format: z.enum(['json', 'csv', 'pdf']).default('json'),
    }),
};

/**
 * User management validation schemas
 */
export const userSchemas = {
    create: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),
        role: z.enum(['admin', 'agent']),
        phone: z.string().optional(),
    }),

    update: z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(['admin', 'agent']).optional(),
        isActive: z.boolean().optional(),
    }),

    query: z.object({
        search: z.string().optional(),
        role: z.enum(['admin', 'agent']).optional(),
        isActive: z.coerce.boolean().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
    }),
};

/**
 * Portfolio validation schemas
 */
export const portfolioSchemas = {
    create: z.object({
        farmerId: z.string().uuid(),
        name: z.string().min(2),
        type: z.enum(['crop', 'livestock', 'mixed']),
        description: z.string().optional(),
        establishedDate: z.coerce.date().optional(),
    }),

    update: z.object({
        name: z.string().min(2).optional(),
        type: z.enum(['crop', 'livestock', 'mixed']).optional(),
        description: z.string().optional(),
        establishedDate: z.coerce.date().optional(),
        isActive: z.boolean().optional(),
    }),

    addRecord: z.object({
        portfolioId: z.string().uuid(),
        type: z.enum(['planting', 'harvest', 'treatment', 'observation']),
        date: z.coerce.date(),
        quantity: z.number().positive().optional(),
        unit: z.string().optional(),
        notes: z.string().optional(),
        images: z.array(z.string().url()).default([]),
    }),
};

/**
 * AI validation schemas
 */
export const aiSchemas = {
    synthesizeVisit: z.object({
        notes: z.string().min(10, 'Notes must be at least 10 characters'),
        farmerId: z.string().uuid().optional(),
    }),
};

/**
 * Field & Crop validation schemas
 */
export const fieldSchemas = {
    create: z.object({
        farmerId: z.string().uuid('Invalid farmer ID'),
        name: z.string().min(2, 'Name must be at least 2 characters'),
        areaHectares: z.number().positive().optional(),
        soilType: z.string().optional(),
        soilPh: z.number().min(0).max(14).optional(),
        boundaryCoordinates: z.any().optional(),
    }),

    update: z.object({
        name: z.string().min(2).optional(),
        areaHectares: z.number().positive().optional(),
        soilType: z.string().optional(),
        soilPh: z.number().min(0).max(14).optional(),
        boundaryCoordinates: z.any().optional(),
        isActive: z.boolean().optional(),
    }),
};

export const cropCycleSchemas = {
    create: z.object({
        fieldId: z.string().uuid('Invalid field ID'),
        cropName: z.string().min(2, 'Crop name is required'),
        variety: z.string().optional(),
        status: z.enum(['planned', 'growing', 'harvested', 'failed']).default('planned'),
        plantingDate: z.coerce.date().optional(),
        expectedHarvestDate: z.coerce.date().optional(),
        notes: z.string().optional(),
    }),

    update: z.object({
        cropName: z.string().min(2).optional(),
        variety: z.string().optional(),
        status: z.enum(['planned', 'growing', 'harvested', 'failed']).optional(),
        plantingDate: z.coerce.date().optional(),
        expectedHarvestDate: z.coerce.date().optional(),
        actualHarvestDate: z.coerce.date().optional(),
        yieldKg: z.number().nonnegative().optional(),
        notes: z.string().optional(),
    }),
};

