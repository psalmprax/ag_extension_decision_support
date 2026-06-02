import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export type UserRole = 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';

// AuthRequest is now a type alias for Request because Request is augmented globally in types.d.ts
export type AuthRequest = Request;

/**
 * Authorization middleware factory
 * Checks if the user has the required role(s)
 */
export const authorize = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Get token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                    success: false,
                    error: 'No token provided',
                });
                return;
            }

            const token = authHeader.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret) as {
                userId: string;
                email: string;
                role: UserRole;
            };

            // Attach user to request
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
            };

            // Check if user role is allowed
            if (!allowedRoles.includes(decoded.role)) {
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
 * Attaches user to request if token is valid, but doesn't require it
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret as jwt.Secret) as {
            userId: string;
            email: string;
            role: UserRole;
        };

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };

        next();
    } catch {
        // Token invalid or expired - continue without user
        next();
    }
};

/**
 * Check if user owns resource or is admin
 */
export const ownershipOrAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { userId } = req.params;

    // If no user attached, deny
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: 'Authentication required',
        });
        return;
    }

    // Admin can do anything
    if (req.user.role === 'admin') {
        return next();
    }

    // Check if user owns the resource
    if (req.user.userId === userId) {
        return next();
    }

    // Regional managers can access resources within their region
    if (req.user.role === 'regional_manager') {
        try {
            const { query } = await import('@/services/databaseService');
            const [managerResult, targetResult] = await Promise.all([
                query('SELECT region FROM users WHERE id = $1', [req.user.userId]),
                query('SELECT region FROM users WHERE id = $1', [userId]),
            ]);
            const managerRegion = managerResult.rows[0]?.region;
            const targetRegion = targetResult.rows[0]?.region;
            if (managerRegion && targetRegion && managerRegion === targetRegion) {
                return next();
            }
            logger.warn(`Regional manager ${req.user.userId} (${managerRegion}) denied access to user ${userId} (${targetRegion})`);
        } catch (err) {
            logger.error('Region check failed:', err);
        }
        res.status(403).json({
            success: false,
            error: 'Regional managers can only access resources within their region',
        });
        return;
    }

    res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource',
    });
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

/**
 * Permission-based middleware
 */
export const requirePermission = (permission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        if (!hasPermission(req.user.role as UserRole, permission)) {
            res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
            });
            return;
        }

        next();
    };
};
