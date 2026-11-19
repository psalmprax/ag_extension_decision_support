import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '@/config';

export interface SessionTokenClaims {
    userId: string;
    email: string;
    role: string;
}

/**
 * Signs a session token. Each token carries its own id (`jti`): a session is
 * stored by the token's hash, and two logins by one account within the same
 * second (a double-click, phone and laptop together, a refresh right after
 * login) otherwise produced byte-identical tokens and the second login failed
 * on the duplicate session (HTTP 500).
 */
export function signSessionToken(claims: SessionTokenClaims): string {
    return jwt.sign(
        { userId: claims.userId, email: claims.email, role: claims.role },
        config.jwt.secret as jwt.Secret,
        {
            algorithm: 'HS256',
            expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
            jwtid: randomUUID(),
        }
    );
}
