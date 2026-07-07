import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { query, getPool } from '../../services/databaseService';

// ─── Typed mock handles ──────────────────────────────────────────────────────
//
// Each new test file should inline its own `jest.mock(...)` calls at the top
// (Jest hoists these to the file's top, which means they can't live inside a
// helper function), then re-import `query` / `getPool` and assign to these
// typed handles. Example:
//
//   jest.mock('../services/databaseService', () => ({ ... }));
//   import { query } from '../services/databaseService';
//   const mockQuery = query as jest.Mock;
//
// `makeOfficerToken` generates a signed JWT for use in the `Authorization`
// header. Override any claim via the optional argument.

export const mockQuery = query as jest.Mock;
export const mockGetPool = getPool as jest.Mock;

export function makeOfficerToken(
    overrides: { userId?: string; role?: string; email?: string } = {}
): string {
    return jwt.sign(
        {
            userId: overrides.userId ?? 'off-1',
            role: overrides.role ?? 'extension_officer',
            email: overrides.email ?? 'officer@example.com',
        },
        config.jwt.secret,
        { expiresIn: '1h' }
    );
}
