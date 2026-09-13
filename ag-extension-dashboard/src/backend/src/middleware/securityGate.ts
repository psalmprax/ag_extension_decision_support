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

// Decode inputs larger than this are treated as pure binary and never decoded.
const MAX_DECODE_INPUT_CHARS = 1_000_000;
const MIN_SMUGGLED_TEXT_CHARS = 24;

/** True when ≥90% of the sampled string is printable ASCII (incl. common whitespace). */
function isMostlyPrintableText(s: string): boolean {
  if (!s) return false;
  const n = Math.min(s.length, 4096);
  let printable = 0;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) printable++;
  }
  return printable / n >= 0.9;
}

/**
 * Decode a base64 (standard or URL-safe) media value and return the text when
 * it decodes to mostly printable ASCII — i.e. someone smuggled plain text
 * inside a media field. Returns null for genuine binary media (decoded bytes
 * are non-printable) so binary noise never reaches the injection scanner.
 */
function decodeSmuggledText(val: string): string | null {
  const trimmed = val.trim();
  if (trimmed.length < MIN_SMUGGLED_TEXT_CHARS || trimmed.length > MAX_DECODE_INPUT_CHARS) return null;
  // For data URLs, decode only the payload after the ;base64, marker.
  const marker = ';base64,';
  const markerIdx = trimmed.toLowerCase().indexOf(marker);
  const b64 = markerIdx >= 0 ? trimmed.slice(markerIdx + marker.length) : trimmed;
  if (b64.length < MIN_SMUGGLED_TEXT_CHARS) return null;
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const decoded = Buffer.from(normalized, 'base64').toString('utf8');
  return isMostlyPrintableText(decoded) ? decoded : null;
}

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

/**
 * Prepare payloads for perimeter inspection: media fields that decode to
 * genuine binary are replaced with a sentinel (prevents false-positive blocks
 * on audio/image blobs), while media fields that decode to printable text are
 * UNREDACTED in decoded form so hidden injection payloads are still scanned.
 */
function redactMediaPayloads(payload: unknown, key = '', depth = 0): unknown {
  if (depth > 20) return '[NESTING_LIMIT_EXCEEDED]';
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') {
    if (!isMediaValue(key, payload)) return payload;
    const smuggled = decodeSmuggledText(payload);
    return smuggled !== null ? smuggled : '[SANITIZED_MEDIA_PAYLOAD]';
  }
  if (Array.isArray(payload)) {
    return payload.map(item => redactMediaPayloads(item, key, depth + 1));
  }
  if (typeof payload === 'object') {
    const cleaned: Record<string, unknown> = Object.create(null);
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      cleaned[k] = redactMediaPayloads(v, k, depth + 1);
    }
    return cleaned;
  }
  return payload;
}

function checkQuerySecurity(req: Request): { blocked: boolean; threats: string[] } {
  try {
    const hasQuery = req.query && Object.keys(req.query).length > 0;
    const hasParams = req.params && Object.keys(req.params).length > 0;
    if (!hasQuery && !hasParams) return { blocked: false, threats: [] };

    const queryStr = JSON.stringify(req.query || {});
    const paramsStr = JSON.stringify(req.params || {});
    const combined = queryStr + paramsStr;
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

  // Scan query params and URL params for threats across all HTTP methods
  const { blocked: queryBlocked, threats: queryThreats } = checkQuerySecurity(req);
  if (queryBlocked) {
    logger.warn(`Security gate blocked ${method} request to ${req.path} (query/params): ${queryThreats.join('; ')}`);
    return res.status(403).json({
      success: false,
      error: 'Request blocked by security filter',
      details: 'Potential security threat detected in query parameters',
    });
  }

  // Scan POST/PUT/PATCH/DELETE bodies for threats (with media payloads safely neutralized)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const { blocked: bodyBlocked, threats: bodyThreats } = checkBodySecurity(req);
    if (bodyBlocked) {
      logger.warn(`Security gate blocked ${method} request to ${req.path} (body): ${bodyThreats.join('; ')}`);
      return res.status(403).json({
        success: false,
        error: 'Request blocked by security filter',
        details: 'Potential security threat detected',
      });
    }
  }

  next();
}
