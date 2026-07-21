import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Distributed Tracing & Correlation ID Middleware
 * Assigns or propagates x-correlation-id across microservices and log contexts.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    `corr-${crypto.randomUUID()}`;

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
};
