import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware factory
 * Validates request body, query, and params against Zod schemas
 */
export const validate = (schema: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate body
            if (schema.body) {
                schema.body.parse(req.body);
            }

            // Validate query parameters
            if (schema.query) {
                schema.query.parse(req.query);
            }

            // Validate URL parameters
            if (schema.params) {
                schema.params.parse(req.params);
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
