import { Request, Response, NextFunction } from 'express';
import { aegisShield } from '@/services/security/aegisShield';
import { logger } from '@/utils/logger';

const MEDIA_KEYS = new Set([
  'audio',
  'audiourl',
  'audiobase64',
  'audio_base64',
  'image',
  'images',
  'imagedata',
  'image_data',
  'photo',
  'photos',
  'recording',
  'recordings',
  'video',
  'videodata',
  'video_data',
  'avatar',
  'file',
  'files',
  'filedata',
  'file_data',
  'document',
  'documents',
  'media',
  'dataurl',
  'data_url',
  'attachment',
  'attachments',
  'voicenote',
  'voice_note',
]);

const DATA_URL_REGEX = /^data:(audio|image|video|application)\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9.+=" \-_]+)*;base64,[A-Za-z0-9+/=\-_ \r\n]+$/i;
const BASE64_CHAR_REGEX = /^[A-Za-z0-9+/=\-_ \r\n]+$/;

/** Check if a string property represents a legitimate binary media payload rather than injection text. */
function isMediaValue(key: string, val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (DATA_URL_REGEX.test(trimmed)) return true;
  const lowerKey = key.toLowerCase();
  if (MEDIA_KEYS.has(lowerKey) && trimmed.length > 50 && BASE64_CHAR_REGEX.test(trimmed)) {
    return true;
  }
  return false;
}

/** Redact media/binary payloads before perimeter inspection to prevent false-positive base64 payload blocks. */
function redactMediaPayloads(payload: unknown, key = '', depth = 0): unknown {
  if (depth > 20) return '[NESTING_LIMIT_EXCEEDED]';
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') {
    return isMediaValue(key, payload) ? '[SANITIZED_MEDIA_PAYLOAD]' : payload;
  }
  if (Array.isArray(payload)) {
    return payload.map(item => redactMediaPayloads(item, key, depth + 1));
  }
  if (typeof payload === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      cleaned[k] = redactMediaPayloads(v, k, depth + 1);
    }
    return cleaned;
  }
  return payload;
}

function checkQuerySecurity(req: Request): { blocked: boolean; threats: string[] } {
  try {
    const queryStr = JSON.stringify(req.query || {});
    const paramsStr = JSON.stringify(req.params || {});
    const combined = queryStr + paramsStr;
    if (combined.length <= 2) return { blocked: false, threats: [] };
    const check = aegisShield.sanitizeInput(combined);
    return { blocked: !check.clean, threats: check.threats };
  } catch (err) {
    logger.warn('Security gate error checking query parameters:', err);
    return { blocked: true, threats: ['Malformed query parameters'] };
  }
}

function checkBodySecurity(req: Request): { blocked: boolean; threats: string[] } {
  try {
    const sanitizedBody = redactMediaPayloads(req.body || {});
    const bodyStr = JSON.stringify(sanitizedBody);
    if (bodyStr.length <= 2) return { blocked: false, threats: [] };
    const check = aegisShield.sanitizeInput(bodyStr);
    return { blocked: !check.clean, threats: check.threats };
  } catch (err) {
    logger.warn('Security gate error checking body parameters:', err);
    return { blocked: true, threats: ['Malformed request body structure'] };
  }
}

export function securityGate(req: Request, res: Response, next: NextFunction) {
  const method = req.method;

  // Scan GET query params and URL params for threats
  if (method === 'GET') {
    const { blocked, threats } = checkQuerySecurity(req);
    if (blocked) {
      logger.warn(`Security gate blocked GET request to ${req.path}: ${threats.join('; ')}`);
      return res.status(403).json({
        success: false,
        error: 'Request blocked by security filter',
        details: 'Potential security threat detected in query parameters',
      });
    }
  }

  // Scan POST/PUT/PATCH/DELETE bodies for threats (with media payloads safely neutralized)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const { blocked, threats } = checkBodySecurity(req);
    if (blocked) {
      logger.warn(`Security gate blocked request to ${req.path}: ${threats.join('; ')}`);
      return res.status(403).json({
        success: false,
        error: 'Request blocked by security filter',
        details: 'Potential security threat detected',
      });
    }
  }

  next();
}
