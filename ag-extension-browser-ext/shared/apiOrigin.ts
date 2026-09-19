/**
 * API origin allowlist.
 *
 * The extension holds the user's bearer token. Every request that carries — or will
 * later be replayed with — that token must target the configured API origin only.
 * Without this gate, anything running in the extension (e.g. a compromised content
 * script) could queue or issue a request to an arbitrary host and receive the token.
 */
import CONFIG, { resolveApiBase } from './config';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Additional allowed origins from build-time env (comma-separated), for deployments
 * that legitimately talk to more than one API host.
 */
function configuredExtraOrigins(): string[] {
  const env = (import.meta as unknown as { env?: { VITE_ALLOWED_API_ORIGINS?: string } }).env;
  const raw = env?.VITE_ALLOWED_API_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map(value => originOf(value.trim()))
    .filter((origin): origin is string => Boolean(origin));
}

/** Origins the extension may attach its bearer token to. */
export async function allowedApiOrigins(): Promise<string[]> {
  const origins = new Set<string>(configuredExtraOrigins());
  const baseOrigin = originOf(await resolveApiBase()) ?? originOf(CONFIG.API_BASE_URL);
  if (baseOrigin) origins.add(baseOrigin);
  return [...origins];
}

/**
 * True when `rawUrl` targets an allowed API origin.
 * Relative URLs resolve to nothing and are refused: token-bearing requests must be
 * absolute and explicitly addressed.
 */
export async function isAllowedApiUrl(rawUrl: string): Promise<boolean> {
  const target = originOf(rawUrl);
  if (!target) return false;
  return (await allowedApiOrigins()).includes(target);
}
