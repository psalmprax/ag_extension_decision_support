import { Request, Response, NextFunction } from 'express';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/**
 * Audit trail for privileged / sensitive mutations.
 *
 * Two entry points:
 *  - `auditMiddleware(action)` — explicit, per-route (auth flows, etc.).
 *  - `globalAuditMiddleware`    — mounted once in app.ts; records every 2xx
 *    POST/PUT/PATCH/DELETE performed by an admin or regional_manager, plus any
 *    request (any role) to a path in SENSITIVE_PATHS. This is what prevents the
 *    "we forgot to add auditing to that new admin route" failure mode.
 *
 * Rows go to `audit_logs` (see prisma AuditLog). Bodies are redacted and capped.
 */

const SENSITIVE_PATHS: RegExp[] = [
    /^\/api\/v1\/billing\/(admin|transactions|vouchers|subscription\/cancel)/,
    /^\/api\/v1\/auth\/(sessions|mfa|reset-password|revoke)/,
    /^\/api\/v1\/users\/[^/]+\/(role|status|delete|export)/,
    /^\/api\/v1\/users\/me\/(delete|export)/,
    /^\/api\/v1\/system-health\/recover/,
    /^\/api\/v1\/farmers\/[^/]+$/, // DELETE / PUT on a farmer
    /^\/api\/v1\/offline\/(retry|delete)/,
];

const REDACT_KEYS = new Set(['password', 'newpassword', 'currentpassword', 'token', 'refreshtoken', 'secret', 'otp', 'code', 'apikey', 'authorization', 'card', 'cvv']);
const MAX_BODY_BYTES = 4096;

function redact(value: unknown, depth = 0): unknown {
    if (depth > 4 || value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1));
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
        }
        return out;
    }
    if (typeof value === 'string' && value.length > 512) return `${value.slice(0, 512)}…`;
    return value;
}

function safeBody(body: unknown): unknown {
    try {
        const redacted = redact(body);
        const json = JSON.stringify(redacted);
        if (!json) return null;
        return json.length > MAX_BODY_BYTES ? { _truncated: true, preview: json.slice(0, MAX_BODY_BYTES) } : redacted;
    } catch {
        return null;
    }
}

function inferResource(req: Request): { type: string | null; id: string | null } {
    // /api/v1/<type>/<id>[/...]
    const m = req.originalUrl.replace(/\?.*$/, '').match(/^\/api\/v1\/([a-z-]+)(?:\/([^/]+))?/i);
    if (!m) return { type: null, id: null };
    const type = m[1];
    const candidate = m[2];
    const looksLikeId = candidate && (/^[0-9a-f-]{20,}$/i.test(candidate) || /^\d+$/.test(candidate));
    return { type, id: looksLikeId ? candidate : (req.params?.id as string) || null };
}

export async function writeAuditLog(entry: {
    actorId?: string | null;
    actorRole?: string | null;
    action: string;
    method: string;
    path: string;
    resourceType?: string | null;
    resourceId?: string | null;
    statusCode: number;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestBody?: unknown;
}): Promise<void> {
    try {
        await query(
            `INSERT INTO audit_logs
               (actor_id, actor_role, action, method, path, resource_type, resource_id, status_code, ip_address, user_agent, request_body, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
            [
                entry.actorId ?? null,
                entry.actorRole ?? null,
                entry.action.slice(0, 120),
                entry.method.slice(0, 10),
                entry.path.slice(0, 512),
                entry.resourceType ?? null,
                entry.resourceId ? String(entry.resourceId).slice(0, 120) : null,
                entry.statusCode,
                entry.ipAddress ?? null,
                entry.userAgent ? entry.userAgent.slice(0, 512) : null,
                // Redact here (not only in the middleware) so every caller is covered.
                entry.requestBody === undefined ? null : JSON.stringify(safeBody(entry.requestBody)),
            ]
        );
    } catch (err) {
        // Never fail the request because auditing failed, but never be silent either.
        logger.error('Audit log write failed:', err);
    }
}

function recordOnFinish(req: Request, res: Response, action: string): void {
    if (typeof res.on !== 'function') return;
    res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const { type, id } = inferResource(req);
        void writeAuditLog({
            actorId: req.user?.userId ?? null,
            actorRole: req.user?.role ?? null,
            action,
            method: req.method,
            path: req.originalUrl.replace(/\?.*$/, ''),
            resourceType: type,
            resourceId: id,
            statusCode: res.statusCode,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestBody: safeBody(req.body),
        });
    });
}

/** Explicit per-route audit with a stable action name. */
export const auditMiddleware = (actionType: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        (req as Request & { __audited?: boolean }).__audited = true;
        recordOnFinish(req, res, actionType);
        next();
    };
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Mounted once after auth: audits privileged mutations without per-route wiring. */
export function globalAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!MUTATING.has(req.method)) return next();
    if ((req as Request & { __audited?: boolean }).__audited) return next();
    const path = req.originalUrl.replace(/\?.*$/, '');
    const privilegedActor = req.user?.role === 'admin' || req.user?.role === 'regional_manager';
    const sensitive = SENSITIVE_PATHS.some(rx => rx.test(path));
    if (!privilegedActor && !sensitive) return next();
    const { type } = inferResource(req);
    const action = `${req.method.toLowerCase()}.${type ?? 'unknown'}`;
    recordOnFinish(req, res, action);
    next();
}

/**
 * Specifically log profile changes or sensitive farmer data access (imperative API).
 */
export const logSensitiveAction = async (userId: string, action: string, metadata: Record<string, unknown>) => {
    await writeAuditLog({
        actorId: userId,
        action,
        method: 'APP',
        path: String(metadata.path ?? '-'),
        resourceType: typeof metadata.resourceType === 'string' ? metadata.resourceType : null,
        resourceId: typeof metadata.resourceId === 'string' ? metadata.resourceId : null,
        statusCode: 200,
        requestBody: safeBody(metadata),
    });
};
