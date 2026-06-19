import { Response } from 'express';

export interface SuccessResponse<T = unknown> {
    success: true;
    data: T;
    message?: string;
}

export interface ErrorResponse {
    success: false;
    error: string;
    errorCode?: string;
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
    res.status(statusCode).json({ success: true, data } as SuccessResponse<T>);
}

export function sendCreated<T>(res: Response, data: T): void {
    sendSuccess(res, data, 201);
}

export function sendError(res: Response, statusCode: number, message: string, errorCode?: string): void {
    const response: ErrorResponse = { success: false, error: message };
    if (errorCode) response.errorCode = errorCode;
    res.status(statusCode).json(response);
}

export function sendBadRequest(res: Response, message: string, errorCode?: string): void {
    sendError(res, 400, message, errorCode);
}

export function sendUnauthorized(res: Response, message: string = 'Authentication required'): void {
    sendError(res, 401, message);
}

export function sendForbidden(res: Response, message: string = 'Access denied'): void {
    sendError(res, 403, message);
}

export function sendNotFound(res: Response, message: string): void {
    sendError(res, 404, message);
}

export function sendDatabaseError(res: Response): void {
    sendError(res, 503, 'Database unavailable', 'DATABASE_ERROR');
}

export function sendServiceUnavailable(res: Response, message: string = 'Service unavailable'): void {
    sendError(res, 503, message);
}
