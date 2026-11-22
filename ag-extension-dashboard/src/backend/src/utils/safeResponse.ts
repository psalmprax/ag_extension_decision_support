import { Response } from 'express';

/** Send error response only if headers haven't been sent yet */
export function safeError(res: Response, status: number, message: string) {
    if (!res.headersSent) {
        res.status(status).json({ success: false, error: message });
    }
}

/**
 * Answers a failed request: 503 when no AI provider can serve it (a passing outage the
 * caller can retry), 500 with the given message otherwise.
 */
export function failRequest(res: Response, error: unknown, message: string) {
    if ((error as { name?: string })?.name === 'AIUnavailableError') {
        return safeError(res, 503, 'The AI service is not available right now. Try again shortly.');
    }
    return safeError(res, 500, message);
}
