import { query } from '@/services/databaseService';

/**
 * System administrators sit above tenants: only they may create an `admin`
 * account, promote a user to `admin`, or modify an existing system
 * administrator. The flag is read from the database on every request rather
 * than trusted from the JWT, so revoking it takes effect immediately instead of
 * at token expiry. Demo accounts never count, whatever their flag says: they are
 * read-only and share a public password.
 */
export async function isSystemAdminUser(userId: string): Promise<boolean> {
    const { rows } = await query<{ is_system_admin: boolean | null }>(
        'SELECT is_system_admin FROM users WHERE id = $1 AND COALESCE(is_demo, false) = false',
        [userId]
    );
    return rows[0]?.is_system_admin === true;
}

/**
 * Number of system administrators that can still sign in. Used to refuse the
 * demotion or deactivation of the last remaining one.
 */
export async function countActiveSystemAdmins(): Promise<number> {
    const { rows } = await query<{ total: number | string | null }>(
        `SELECT COUNT(*)::int AS total
           FROM users
          WHERE is_system_admin = true
            AND COALESCE(is_active, true) = true
            AND COALESCE(is_demo, false) = false`
    );
    return Number(rows[0]?.total ?? 0);
}

/**
 * The flag as reported to clients. A demo row never reports it, so the app never
 * shows admin-creation controls to a session the server would refuse anyway.
 */
export function reportedSystemAdmin(row: {
    is_system_admin?: boolean | null;
    is_demo?: boolean | null;
    email?: string | null;
}): boolean {
    if (row.is_demo === true || row.email?.toLowerCase().endsWith('@agridemo.com')) return false;
    return row.is_system_admin === true;
}
