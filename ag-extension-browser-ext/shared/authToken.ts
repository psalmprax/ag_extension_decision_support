/**
 * Minimal JWT helpers for the extension (no signature verification — the backend
 * does that). Used only to avoid sending obviously expired tokens.
 */
export function decodeJwtExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewMs = 30_000): boolean {
  const exp = decodeJwtExpiry(token);
  return exp !== null && exp - skewMs <= Date.now();
}

/** Storage key for the extension's bearer token. */
const AUTH_TOKEN_KEY = 'authToken';

type TokenArea = Pick<typeof browser.storage.local, 'get' | 'set' | 'remove'>;

/**
 * Prefer `storage.session`, which lives in memory only, so the bearer token is never
 * written to the extension's on-disk profile. Fall back to `storage.local` only where
 * `storage.session` is unavailable (older Firefox), and never throw: a storage hiccup
 * must not break an offline-first write.
 */
function tokenArea(): TokenArea {
  const storage = browser.storage as typeof browser.storage & { session?: TokenArea };
  return storage.session ?? browser.storage.local;
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const stored = await tokenArea().get(AUTH_TOKEN_KEY);
    const token = (stored as Record<string, unknown>)?.[AUTH_TOKEN_KEY];
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  const area = tokenArea();
  try {
    if (token) await area.set({ [AUTH_TOKEN_KEY]: token });
    else await area.remove(AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('Could not persist the auth token:', error instanceof Error ? error.message : error);
  }
  // A token may linger in the other area from an older build that always used
  // storage.local; clear it so a stale credential is not left behind on disk.
  if (area !== browser.storage.local) {
    await browser.storage.local.remove(AUTH_TOKEN_KEY).catch(() => {});
  }
}
