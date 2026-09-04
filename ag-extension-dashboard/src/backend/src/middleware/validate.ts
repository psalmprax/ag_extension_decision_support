import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodObject, type ZodRawShape } from 'zod';

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
        const shape = schema.shape as ZodRawShape;
        bodySchema = shape.body as ZodSchema | undefined;
        querySchema = shape.query as ZodSchema | undefined;
        paramsSchema = shape.params as ZodSchema | undefined;
    } else {
        // Flat format: { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
        const s = schema as { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };
        bodySchema = s.body;
        querySchema = s.query;
        paramsSchema = s.params;
    }

    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Assign the parsed output back so defaults, coercions and transforms
            // (e.g. snake_case → camelCase normalisation) reach the handler.
            if (bodySchema) {
                req.body = bodySchema.parse(req.body);
            }
            if (querySchema) {
                const parsedQuery = querySchema.parse(req.query);
                // req.query is a getter in Express 5; mutate in place to stay compatible.
                Object.assign(req.query as Record<string, unknown>, parsedQuery);
            }
            if (paramsSchema) {
                Object.assign(req.params, paramsSchema.parse(req.params));
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
