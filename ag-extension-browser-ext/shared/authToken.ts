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
