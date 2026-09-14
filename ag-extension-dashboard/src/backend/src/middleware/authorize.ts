import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { isSessionValid } from '@/services/sessionService';
import { getBearerToken } from '@/middleware/authCookie';

export type UserRole = 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';

// AuthRequest is now a type alias for Request because Request is augmented globally in types.d.ts
export type AuthRequest = Request;

/**
 * Authorization middleware factory
 * Checks if the user has the required role(s)
 */
export const authorize = (allowedRoles: UserRole[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Token source: Authorization header (mobile/extension/API clients)
            // or the httpOnly auth cookie (SPA). Cookie callers are CSRF-checked
            // by csrfProtection upstream.
            const token = getBearerToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'No token provided',
                });
                return;
            }

            // Verify token
            const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret, { algorithms: ['HS256'] }) as {
                userId: string;
                email: string;
                role: UserRole;
            };

            // Check if session has been revoked (DB-backed; see sessionService)
            const sessionActive = await isSessionValid(token);
            if (!sessionActive) {
                res.status(401).json({
                    success: false,
                    error: 'Session has been revoked or expired',
                });
                return;
            }

            // Attach user to request (normalize legacy 'agent' role to 'extension_officer')
            const normalizedRole = decoded.role === ('agent' as unknown as UserRole) ? 'extension_officer' : decoded.role;
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: normalizedRole,
            };

            // Check if user role is allowed
            if (!allowedRoles.includes(normalizedRole) && !allowedRoles.includes(decoded.role)) {
                logger.warn(`User ${decoded.userId} with role ${decoded.role} tried to access forbidden resource`);
                res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                });
                return;
            }

            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                res.status(401).json({
                    success: false,
                    error: 'Token expired',
                });
                return;
            }

            if (error instanceof jwt.JsonWebTokenError) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                });
                return;
            }

            logger.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                error: 'Authorization error',
            });
        }
    };
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it.
 * Validity = JWT signature/expiry AND the session not being revoked/expired
 * (same check as `authorize`). A revoked token is treated as anonymous so it
 * cannot keep privileged rate-limit tiers or pass `req.user`-gated paths.
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        // Header first, then the httpOnly auth cookie — mirrors authorize().
        const token = getBearerToken(req);
        if (!token) {
            return next();
        }
        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret, { algorithms: ['HS256'] }) as {
            userId: string;
            email: string;
            role: UserRole;
        };

        const sessionActive = await isSessionValid(token);
        if (!sessionActive) {
            return next(); // revoked or expired session → continue unauthenticated
        }

        // Normalize legacy 'agent' role to 'extension_officer' — same mapping as
        // `authorize`, so req.user.role is consistent across middleware
        // (rate-limit tiers, audit logs, downstream role checks).
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role === ('agent' as unknown as UserRole) ? 'extension_officer' : decoded.role,
        };

        next();
    } catch {
        // Token invalid or expired - continue without user
        next();
    }
};

/**
 * Permission definitions
 */
export const Permissions = {
    // Admin permissions
    admin: [
        'users:read',
        'users:write',
        'users:delete',
        'farmers:read',
        'farmers:write',
        'farmers:delete',
        'visits:read',
        'visits:write',
        'visits:delete',
        'reports:read',
        'reports:write',
        'reports:delete',
        'analytics:read',
        'settings:read',
        'settings:write',
    ],

    // Regional manager permissions
    regional_manager: [
        'farmers:read',
        'farmers:write',
        'visits:read',
        'visits:write',
        'reports:read',
        'reports:write',
        'analytics:read',
    ],

    // Extension officer permissions
    extension_officer: [
        'farmers:read',
        'farmers:write',
        'visits:read',
        'visits:write',
        'reports:read',
        'analytics:read',
    ],

    // Farmer permissions
    farmer: [
        'farmers:read:own',
        'visits:read:own',
        'reports:read:own',
    ],
} as const;

/**
 * Check specific permission
 */
export const hasPermission = (role: UserRole, permission: string): boolean => {
    const rolePermissions = Permissions[role];
    return (rolePermissions as readonly string[]).includes(permission);
};
