/**
 * Shared SQL fragments for the public user projection.
 *
 * The same column list is needed by the list read, the detail read, the
 * conditional UPDATE ... RETURNING CTE, the plan-refresh read and the
 * INSERT ... RETURNING, each of which also has a legacy-schema variant for
 * databases created before `country` / `last_login_at` existed. Keeping the
 * list here means a new user column is added once instead of in six places
 * that can silently drift apart.
 */

export interface UserColumnsOptions {
    /**
     * Table alias or CTE name the columns are read from (`users`, `updated`,
     * `target`). Omit it for INSERT ... RETURNING: Postgres rejects qualified
     * column references in a RETURNING list.
     */
    source?: string;
    /** Older databases without `country` / `last_login_at`: emit NULL placeholders. */
    legacySchema?: boolean;
    /** `is_demo` is not selected back from INSERT ... RETURNING. */
    includeDemoFlag?: boolean;
}

/** Columns that exist in every schema version, in projection order. */
const LEADING_COLUMNS = ['id', 'email', 'first_name', 'last_name', 'role', 'region'] as const;

/** Columns that follow `country` in projection order. */
const TRAILING_COLUMNS = ['phone', 'is_active', 'avatar_url', 'created_at'] as const;

function qualify(source: string | undefined, column: string): string {
    return source ? `${source}.${column}` : column;
}

/**
 * Builds the shared user projection: the columns every user DTO is mapped from.
 */
export function buildUserColumns(options: UserColumnsOptions = {}): string {
    const { source, legacySchema = false, includeDemoFlag = true } = options;

    const columns: string[] = [
        ...LEADING_COLUMNS.map(column => qualify(source, column)),
        legacySchema ? 'NULL::text AS country' : qualify(source, 'country'),
        legacySchema ? 'false AS is_system_admin' : qualify(source, 'is_system_admin'),
        legacySchema ? 'NULL::uuid AS manager_id' : qualify(source, 'manager_id'),
        ...TRAILING_COLUMNS.map(column => qualify(source, column)),
        'NULL::text AS preferred_language',
        legacySchema ? 'NULL::timestamp AS last_login' : `${qualify(source, 'last_login_at')} AS last_login`,
    ];

    if (includeDemoFlag) {
        columns.push(`COALESCE(${qualify(source, 'is_demo')}, false) AS is_demo`);
    }

    return columns.join(',\n');
}

/** Current-plan columns joined onto a user row. */
export const SUBSCRIPTION_SELECT_COLUMNS = [
    'sp.id AS plan_id',
    'sp.name AS plan_name',
    'sp.price AS plan_price',
    's.status AS subscription_status',
    's.current_period_end AS subscription_period_end',
].join(',\n');

/** Current-plan columns without the plan id: the profile shape used by /auth/me. */
export const SUBSCRIPTION_PLAN_COLUMNS = [
    'sp.name AS plan_name',
    'sp.price AS plan_price',
    's.status AS subscription_status',
    's.current_period_end AS subscription_period_end',
].join(',\n');

const PROFILE_COLUMNS = ['id', 'email', 'first_name', 'last_name', 'role', 'region', 'country', 'phone'] as const;

export interface UserProfileColumnsOptions {
    /** Table alias the columns are read from, when the query aliases `users`. */
    source?: string;
    includeNotificationPreferences?: boolean;
    /** `is_demo` is only selected where the caller branches on demo origin. */
    includeDemoFlag?: boolean;
    /** `is_system_admin` is only selected where the caller needs the flag. */
    includeSystemAdmin?: boolean;
}

/**
 * The auth profile shape (`id, email, first_name, last_name, role, region,
 * phone`): what register, profile update and /auth/me all read back.
 */
export function buildUserProfileColumns(options: UserProfileColumnsOptions = {}): string {
    const {
        source,
        includeNotificationPreferences = false,
        includeDemoFlag = false,
        includeSystemAdmin = false,
    } = options;
    const columns: string[] = PROFILE_COLUMNS.map(column => qualify(source, column));

    if (includeNotificationPreferences) columns.push(qualify(source, 'notification_preferences'));
    if (includeDemoFlag) columns.push(`COALESCE(${qualify(source, 'is_demo')}, false) AS is_demo`);
    if (includeSystemAdmin) columns.push(qualify(source, 'is_system_admin'));

    return columns.join(',\n');
}

/** Joins the caller's active subscription and its plan onto `source`. */
export function buildSubscriptionJoin(source: string): string {
    return `LEFT JOIN subscriptions s ON s.user_id = ${source}.id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id`;
}

export interface UserSubscriptionSelectOptions {
    /** Table or CTE the user row is read from. */
    source: string;
    /** Use NULL placeholders for `country` / `last_login_at`. */
    legacySchema?: boolean;
    /** Predicate without the `WHERE` keyword. */
    where?: string;
    /** ORDER BY clause without the `ORDER BY` keywords. */
    orderBy?: string;
}

/**
 * Builds a user read with the current subscription joined on: the query used by
 * the list and detail endpoints.
 */
export function buildUserSubscriptionSelect(options: UserSubscriptionSelectOptions): string {
    const { source, legacySchema = false, where, orderBy } = options;
    const clauses = [
        `SELECT ${buildUserColumns({ source, legacySchema })},`,
        `       ${SUBSCRIPTION_SELECT_COLUMNS}`,
        `FROM ${source}`,
        buildSubscriptionJoin(source),
    ];

    if (where) clauses.push(`WHERE ${where}`);
    if (orderBy) clauses.push(`ORDER BY ${orderBy}`);

    return clauses.join('\n');
}
