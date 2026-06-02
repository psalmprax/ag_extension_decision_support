import { Request, Response, NextFunction } from 'express';
import { aegisShield } from '@/services/security/aegisShield';
import { logger } from '@/utils/logger';

export function securityGate(req: Request, res: Response, next: NextFunction) {
  const method = req.method;

  // Scan GET query params and URL params for threats
  if (method === 'GET') {
    const queryStr = JSON.stringify(req.query || {});
    const paramsStr = JSON.stringify(req.params || {});
    const combined = queryStr + paramsStr;
    if (combined.length > 2) { // Skip empty objects
      const check = aegisShield.sanitizeInput(combined);
      if (!check.clean) {
        logger.warn(`Security gate blocked GET request to ${req.path}: ${check.threats.join('; ')}`);
        return res.status(403).json({
          success: false,
          error: 'Request blocked by security filter',
          details: 'Potential security threat detected in query parameters',
        });
      }
    }
  }

  // Scan POST/PUT/PATCH/DELETE bodies for threats
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const bodyStr = JSON.stringify(req.body || {});
    const check = aegisShield.sanitizeInput(bodyStr);

    if (!check.clean) {
      logger.warn(`Security gate blocked request to ${req.path}: ${check.threats.join('; ')}`);

      // Block all threats regardless of severity
      return res.status(403).json({
        success: false,
        error: 'Request blocked by security filter',
        details: 'Potential security threat detected',
      });
    }
  }

  next();
}

export function sanitizeToolResult(result: string): { clean: boolean; sanitized: string; threats: string[] } {
  const check = aegisShield.sanitizeToolResult(result);
  return {
    clean: check.clean,
    sanitized: check.sanitizedInput,
    threats: check.threats,
  };
}
