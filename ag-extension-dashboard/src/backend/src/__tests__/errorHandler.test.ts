import { Request, Response, NextFunction } from 'express';
import {
    errorHandler,
    AppError,
    ErrorTypes,
    createError,
    createValidationError,
    createAuthenticationError,
    createAuthorizationError,
    createNotFoundError,
    createConflictError,
    createDatabaseError,
    createRateLimitError,
    createExternalServiceError,
    asyncHandler,
    notFound,
    handlePrismaError,
    handleJsonParseError,
    handleMulterError,
    asyncWrapper,
} from '../middleware/errorHandler';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('Error Handler Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            path: '/api/test',
            method: 'GET',
            headers: {},
            get: jest.fn().mockReturnValue('Mozilla/5.0'),
            ip: '127.0.0.1',
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();
    });

    describe('createError', () => {
        it('should create an error with all properties', () => {
            const error = createError('Test error', 400, ErrorTypes.VALIDATION_ERROR, { field: 'email' });

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorTypes.VALIDATION_ERROR);
            expect(error.isOperational).toBe(true);
            expect(error.details).toEqual({ field: 'email' });
        });

        it('should default to INTERNAL_ERROR type', () => {
            const error = createError('Test error', 500);
            expect(error.code).toBe(ErrorTypes.INTERNAL_ERROR);
        });
    });

    describe('Specific Error Creators', () => {
        it('createValidationError should create 400 error', () => {
            const error = createValidationError({ email: 'Invalid email' });
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorTypes.VALIDATION_ERROR);
            expect(error.details).toEqual({ email: 'Invalid email' });
        });

        it('createAuthenticationError should create 401 error', () => {
            const error = createAuthenticationError('Token expired');
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe(ErrorTypes.AUTHENTICATION_ERROR);
            expect(error.message).toBe('Token expired');
        });

        it('createAuthorizationError should create 403 error', () => {
            const error = createAuthorizationError('Admin only');
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe(ErrorTypes.AUTHORIZATION_ERROR);
        });

        it('createNotFoundError should create 404 error', () => {
            const error = createNotFoundError('User');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe(ErrorTypes.NOT_FOUND_ERROR);
            expect(error.message).toBe('User not found');
        });

        it('createConflictError should create 409 error', () => {
            const error = createConflictError('Email already exists');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe(ErrorTypes.CONFLICT_ERROR);
        });

        it('createDatabaseError should create 500 error', () => {
            const error = createDatabaseError('Connection failed');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe(ErrorTypes.DATABASE_ERROR);
        });

        it('createRateLimitError should create 429 error', () => {
            const error = createRateLimitError('Too many requests');
            expect(error.statusCode).toBe(429);
            expect(error.code).toBe(ErrorTypes.RATE_LIMIT_ERROR);
        });

        it('createExternalServiceError should create 502 error', () => {
            const error = createExternalServiceError('Stripe', 'API down');
            expect(error.statusCode).toBe(502);
            expect(error.code).toBe(ErrorTypes.EXTERNAL_SERVICE_ERROR);
            expect(error.details).toEqual({ service: 'Stripe' });
        });
    });

    describe('errorHandler', () => {
        it('should return error response with correct status code', () => {
            const error = createError('Test error', 400, ErrorTypes.VALIDATION_ERROR);
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalled();
        });

        it('should include error details for validation errors', () => {
            const error = createValidationError({ email: 'Invalid' });
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.error.details).toEqual({ email: 'Invalid' });
        });

        it('should include requestId in response', () => {
            const error = createError('Test', 500);
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.requestId).toBeDefined();
        });

        it('should include timestamp in response', () => {
            const error = createError('Test', 500);
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.timestamp).toBeDefined();
        });

        it('should include stack trace in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = createError('Test', 500);
            error.stack = 'Error stack trace';
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.error.stack).toBe('Error stack trace');

            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack trace in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = createError('Test', 500);
            error.stack = 'Error stack trace';
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.error.stack).toBeUndefined();

            process.env.NODE_ENV = originalEnv;
        });

        it('should default to 500 if no statusCode provided', () => {
            const error = new Error('Generic error') as AppError;
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
        });

        it('should use x-request-id header if provided', () => {
            mockRequest.headers = { 'x-request-id': 'custom-request-id' };
            const error = createError('Test', 500);
            errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

            const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
            expect(response.requestId).toBe('custom-request-id');
        });
    });

    describe('asyncHandler', () => {
        it('should call next with error on promise rejection', async () => {
            const testError = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(testError);
            const handler = asyncHandler(asyncFn);

            handler(mockRequest as Request, mockResponse as Response, mockNext);

            // Wait for promise to resolve
            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalledWith(testError);
        });

        it('should not call next on success', async () => {
            const asyncFn = jest.fn().mockResolvedValue({ success: true });
            const handler = asyncHandler(asyncFn);

            handler(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('notFound', () => {
        it('should call next with 404 error', () => {
            notFound(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = (mockNext as jest.Mock).mock.calls[0][0];
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe(ErrorTypes.NOT_FOUND_ERROR);
        });
    });

    describe('handlePrismaError', () => {
        it('should handle P2002 unique constraint error', () => {
            const prismaError = {
                code: 'P2002',
                meta: { target: ['email'] },
            };

            const error = handlePrismaError(prismaError);
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorTypes.DATABASE_ERROR);
        });

        it('should handle P2001 not found error', () => {
            const prismaError = {
                code: 'P2001',
                meta: { modelName: 'User' },
            };

            const error = handlePrismaError(prismaError);
            expect(error.statusCode).toBe(400);
        });

        it('should handle unknown Prisma errors', () => {
            const prismaError = {
                code: 'UNKNOWN',
                message: 'Unknown error',
            };

            const error = handlePrismaError(prismaError);
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe(ErrorTypes.DATABASE_ERROR);
        });
    });

    describe('handleJsonParseError', () => {
        it('should handle JSON syntax errors', () => {
            const syntaxError = new SyntaxError('Unexpected token');
            syntaxError.message = 'Unexpected token in JSON';

            const error = handleJsonParseError(syntaxError);
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorTypes.VALIDATION_ERROR);
        });

        it('should pass through non-JSON errors', () => {
            const regularError = new Error('Regular error');
            const error = handleJsonParseError(regularError);
            expect(error).toBe(regularError);
        });
    });

    describe('handleMulterError', () => {
        it('should handle LIMIT_FILE_SIZE error', () => {
            const multerError = {
                code: 'LIMIT_FILE_SIZE',
                message: 'File too large',
            };

            const error = handleMulterError(multerError);
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe(ErrorTypes.VALIDATION_ERROR);
        });

        it('should handle LIMIT_UNEXPECTED_FILE error', () => {
            const multerError = {
                code: 'LIMIT_UNEXPECTED_FILE',
                field: 'avatar',
            };

            const error = handleMulterError(multerError);
            expect(error.statusCode).toBe(400);
            expect(error.details).toEqual({ code: 'LIMIT_UNEXPECTED_FILE', field: 'avatar' });
        });

        it('should handle generic multer errors', () => {
            const multerError = {
                message: 'Generic upload error',
            };

            const error = handleMulterError(multerError);
            expect(error.statusCode).toBe(400);
        });
    });

    describe('asyncWrapper', () => {
        it('should handle JsonWebTokenError', async () => {
            const error = { name: 'JsonWebTokenError' };
            const fn = jest.fn().mockRejectedValue(error);

            const wrapped = asyncWrapper(fn);
            wrapped(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalled();
            const passedError = (mockNext as jest.Mock).mock.calls[0][0];
            expect(passedError.code).toBe(ErrorTypes.AUTHENTICATION_ERROR);
        });

        it('should handle TokenExpiredError', async () => {
            const error = { name: 'TokenExpiredError' };
            const fn = jest.fn().mockRejectedValue(error);

            const wrapped = asyncWrapper(fn);
            wrapped(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalled();
            const passedError = (mockNext as jest.Mock).mock.calls[0][0];
            expect(passedError.message).toBe('Token expired');
        });

        it('should handle Prisma errors', async () => {
            const error = { code: 'P2002' };
            const fn = jest.fn().mockRejectedValue(error);

            const wrapped = asyncWrapper(fn);
            wrapped(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalled();
            const passedError = (mockNext as jest.Mock).mock.calls[0][0];
            expect(passedError.code).toBe(ErrorTypes.DATABASE_ERROR);
        });

        it('should handle MulterError', async () => {
            const error = { name: 'MulterError', code: 'LIMIT_FILE_SIZE' };
            const fn = jest.fn().mockRejectedValue(error);

            const wrapped = asyncWrapper(fn);
            wrapped(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalled();
            const passedError = (mockNext as jest.Mock).mock.calls[0][0];
            expect(passedError.code).toBe(ErrorTypes.VALIDATION_ERROR);
        });

        it('should pass through other errors', async () => {
            const error = new Error('Random error');
            const fn = jest.fn().mockRejectedValue(error);

            const wrapped = asyncWrapper(fn);
            wrapped(mockRequest as Request, mockResponse as Response, mockNext);

            await new Promise(process.nextTick);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});