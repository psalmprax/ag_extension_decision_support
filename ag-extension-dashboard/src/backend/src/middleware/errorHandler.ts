import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    code?: string;
    details?: any;
}

// Error types for consistent error handling
export enum ErrorTypes {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
    CONFLICT_ERROR = 'CONFLICT_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// Create specific error types
export function createError(message: string, statusCode: number, type?: ErrorTypes, details?: any): AppError {
    const error: AppError = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    error.code = type || ErrorTypes.INTERNAL_ERROR;
    error.details = details;
    return error;
}

export function createValidationError(details: any): AppError {
    return createError('Validation failed', 400, ErrorTypes.VALIDATION_ERROR, details);
}

export function createAuthenticationError(message = 'Authentication required'): AppError {
    return createError(message, 401, ErrorTypes.AUTHENTICATION_ERROR);
}

export function createAuthorizationError(message = 'Insufficient permissions'): AppError {
    return createError(message, 403, ErrorTypes.AUTHORIZATION_ERROR);
}

export function createNotFoundError(resource = 'Resource'): AppError {
    return createError(`${resource} not found`, 404, ErrorTypes.NOT_FOUND_ERROR);
}

export function createConflictError(message = 'Resource conflict'): AppError {
    return createError(message, 409, ErrorTypes.CONFLICT_ERROR);
}

export function createDatabaseError(message = 'Database operation failed'): AppError {
    return createError(message, 500, ErrorTypes.DATABASE_ERROR);
}

export function createRateLimitError(message = 'Too many requests'): AppError {
    return createError(message, 429, ErrorTypes.RATE_LIMIT_ERROR);
}

export function createExternalServiceError(service: string, message?: string): AppError {
    return createError(
        message || `External service ${service} failed`,
        502,
        ErrorTypes.EXTERNAL_SERVICE_ERROR,
        { service }
    );
}

// Error response interface
interface ErrorResponse {
    success: false;
    error: {
        message: string;
        type?: string;
        code?: string;
        details?: any;
        stack?: string;
    };
    requestId?: string;
    timestamp?: string;
}

/**
 * Comprehensive error handler middleware
 * Handles all types of errors with appropriate status codes and messages
 */
export function errorHandler(
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Generate request ID for tracking
    const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log error with context
    logger.error('Error occurred:', {
        message: err.message,
        type: err.code,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });

    // Determine status code and response
    const statusCode = err.statusCode || 500;
    const errorType = err.code || ErrorTypes.INTERNAL_ERROR;

    // Build error response
    const response: ErrorResponse = {
        success: false,
        error: {
            message: err.message || 'Internal Server Error',
            type: errorType,
            code: err.code,
        },
        requestId,
        timestamp: new Date().toISOString(),
    };

    // Add details for validation errors
    if (err.code === ErrorTypes.VALIDATION_ERROR && err.details) {
        response.error.details = err.details;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.error.stack = err.stack;
    }

    // Send response
    res.status(statusCode).json(response);
}

// Use asyncWrapper below - this is kept for backward compatibility
export const asyncHandler = asyncWrapper;

/**
 * 404 Not Found handler
 */
export function notFound(req: Request, res: Response, next: NextFunction): void {
    const error = createNotFoundError(`Route ${req.method} ${req.path}`);
    next(error);
}

/**
 * Handle Prisma-specific errors
 */
export function handlePrismaError(error: any): AppError {
    // Prisma known error codes
    const prismaErrorMessages: Record<string, string> = {
        P2000: 'The provided value for the column is too long for the column\'s type',
        P2001: 'The record searched for in the where condition could not be found',
        P2002: 'Unique constraint failed on the fields',
        P2003: 'Foreign key constraint failed on the field',
        P2004: 'A constraint failed on the field',
        P2005: 'The provided value for the column is invalid',
        P2006: 'The provided value for the column is invalid',
        P2010: 'Raw query failed',
        P2011: 'Null constraint violation on the fields',
        P2012: 'Required value was missing',
        P2013: 'Required connected records were missing',
        P2014: 'Relation violation',
        P2015: 'Related record was not found',
        P2016: 'Query interpretation error',
        P2017: 'Records not connected',
        P2018: 'The connected records do not exist',
        P2019: 'Input error',
        P2020: 'Value out of range',
        P2021: 'Table does not exist',
        P2022: 'Column does not exist',
        P2023: 'Inconsistent column data',
        P2024: 'Timeout fetching connection',
        P2025: 'Operation relies on a missing type',
        P2026: 'Current provider does not support this feature',
        P2027: 'Multiple errors during execution',
        P2028: 'Transaction API error',
        P2030: 'No full-text index exists',
        P2031: 'MongoDB replica set required',
        P2033: 'Number out of range',
        P2034: 'Transaction failed due to deadlock',
    };

    if (error.code && prismaErrorMessages[error.code]) {
        return createError(
            prismaErrorMessages[error.code],
            400,
            ErrorTypes.DATABASE_ERROR,
            { prismaCode: error.code, meta: error.meta }
        );
    }

    return createDatabaseError(error.message || 'Database operation failed');
}

/**
 * Handle Sequelize-specific errors (if using Sequelize)
 */
export function handleSequelizeError(error: any): AppError {
    const sequelizeErrorMessages: Record<string, string> = {
        UNIQUE_CONSTRAINT: 'A unique constraint violation occurred',
        FOREIGN_KEY_CONSTRAINT: 'A foreign key constraint violation occurred',
        NOT_NULL_CONSTRAINT: 'A not null constraint violation occurred',
        CHECK_CONSTRAINT: 'A check constraint violation occurred',
    };

    if (error.original?.code && sequelizeErrorMessages[error.original.code]) {
        return createError(
            sequelizeErrorMessages[error.original.code],
            400,
            ErrorTypes.DATABASE_ERROR,
            { sequelizeCode: error.original.code }
        );
    }

    return createDatabaseError(error.message || 'Database operation failed');
}

/**
 * Handle JSON parsing errors
 */
export function handleJsonParseError(error: any): AppError {
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return createError(
            'Invalid JSON in request body',
            400,
            ErrorTypes.VALIDATION_ERROR,
            { originalError: error.message }
        );
    }
    return error;
}

/**
 * Handle multer (file upload) errors
 */
export function handleMulterError(error: any): AppError {
    const multerErrorMessages: Record<string, string> = {
        LIMIT_FILE_SIZE: 'File size exceeds the maximum allowed limit',
        LIMIT_FILE_COUNT: 'Maximum file count exceeded',
        LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
        LIMIT_HIDDEN_FILES: 'Hidden files are not allowed',
    };

    if (error.code && multerErrorMessages[error.code]) {
        return createError(
            multerErrorMessages[error.code],
            400,
            ErrorTypes.VALIDATION_ERROR,
            { code: error.code, field: error.field }
        );
    }

    return createError(
        error.message || 'File upload failed',
        400,
        ErrorTypes.VALIDATION_ERROR
    );
}

/**
 * Error handling for Express async routes
 * This ensures all async errors are properly caught and passed to the error handler
 */
export const asyncWrapper = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err: any) => {
        // Handle specific error types
        if (err.name === 'JsonWebTokenError') {
            return next(createAuthenticationError('Invalid token'));
        }
        if (err.name === 'TokenExpiredError') {
            return next(createAuthenticationError('Token expired'));
        }
        if (err.code === 'P2000' || err.code?.startsWith('P2')) {
            return next(handlePrismaError(err));
        }
        if (err.name === 'MulterError') {
            return next(handleMulterError(err));
        }
        next(err);
    });
};