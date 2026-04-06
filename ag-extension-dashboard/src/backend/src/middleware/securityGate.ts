import { Request, Response, NextFunction } from 'express';
import { aegisShield } from '@/services/security/aegisShield';
import { logger } from '@/utils/logger';

export function securityGate(req: Request, res: Response, next: NextFunction) {
  const method = req.method;

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const bodyStr = JSON.stringify(req.body || '');
    const check = aegisShield.sanitizeInput(bodyStr);

    if (!check.clean) {
      logger.warn(`Security gate blocked request to ${req.path}: ${check.threats.join('; ')}`);

      if (check.severity === 'critical' || check.severity === 'high') {
        return res.status(403).json({
          success: false,
          error: 'Request blocked by security filter',
          details: 'Potential security threat detected',
        });
      }

      try {
        req.body = JSON.parse(check.sanitizedInput);
      } catch {
        req.body = { ...req.body, _sanitized: true };
      }
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
