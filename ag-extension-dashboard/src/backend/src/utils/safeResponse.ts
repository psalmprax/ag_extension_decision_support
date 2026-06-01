import { Response } from 'express';

/** Send error response only if headers haven't been sent yet */
export function safeError(res: Response, status: number, message: string) {
    if (!res.headersSent) {
        res.status(status).json({ success: false, error: message });
    }
}
