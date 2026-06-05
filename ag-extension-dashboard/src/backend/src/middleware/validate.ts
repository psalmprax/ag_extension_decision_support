import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodObject } from 'zod';

/**
 * Validation middleware factory
 * Validates request body, query, and params against Zod schemas.
 *
 * Accepts two formats:
 * 1. Flat: { body: z.object({...}), query: z.object({...}) }
 * 2. Wrapped: z.object({ body: z.object({...}), query: z.object({...}) })
 */
export const validate = (schema: ZodSchema | { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) => {
    // Normalize: if schema is a ZodObject with body/query/params keys, extract them
    let bodySchema: ZodSchema | undefined;
    let querySchema: ZodSchema | undefined;
    let paramsSchema: ZodSchema | undefined;

    if (schema instanceof ZodObject && '_def' in schema) {
        // Wrapped format: z.object({ body: ..., query: ..., params: ... })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shape = (schema as any)._def.shape();
        bodySchema = shape.body;
        querySchema = shape.query;
        paramsSchema = shape.params;
    } else {
        // Flat format: { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
        const s = schema as { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };
        bodySchema = s.body;
        querySchema = s.query;
        paramsSchema = s.params;
    }

    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (bodySchema) {
                bodySchema.parse(req.body);
            }
            if (querySchema) {
                querySchema.parse(req.query);
            }
            if (paramsSchema) {
                paramsSchema.parse(req.params);
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                }));
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors,
                });
            }
            next(error);
        }
    };
};

/**
 * Common validation schemas for the application
 */
export const commonSchemas = {
    // Pagination query schema
    pagination: {
        query: z.object({
            page: z.coerce.number().int().positive().default(1),
            limit: z.coerce.number().int().positive().max(100).default(20),
        }),
    },

    // ID parameter schema
    idParam: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },

    // Date range query schema
    dateRange: {
        query: z.object({
            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),
        }),
    },
};

// Re-export zod for convenience
export { z };
