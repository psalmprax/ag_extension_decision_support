/**
 * Global Configuration for AG Extension
 *
 * Uses Vite/WXT import.meta.env — typed via ImportMeta interface extension.
 *
 * IMPORTANT: the extension runs on a chrome-extension:// origin, so the API base
 * MUST be absolute. A relative default like '/api/v1' silently resolves against
 * the extension origin and every request fails. The default below matches the
 * docker-compose backend port mapping (7500 -> 3001) and the manifest's
 * host_permissions; override at build time with VITE_API_URL, or at runtime via
 * the popup Settings (persisted as `apiEndpoint`).
 */

interface ImportMetaEnv {
  VITE_API_URL?: string;
  MODE?: string;
}

// Safely access import.meta.env with proper type handling
const metaEnv = (import.meta as unknown as { env: ImportMetaEnv }).env;

const DEFAULT_API_BASE_URL = 'http://localhost:7500/api/v1';

function normalizeBase(value: string | undefined): string {
  const v = (value || '').trim().replace(/\/+$/, '');
  if (!v) return DEFAULT_API_BASE_URL;
  if (!/^https?:\/\//i.test(v)) {
    console.warn(`[config] API base "${v}" is not absolute; falling back to ${DEFAULT_API_BASE_URL}`);
    return DEFAULT_API_BASE_URL;
  }
  return v;
}

export const CONFIG = {
  // API Endpoints — absolute URL, e.g. https://api.gpexts.com/api/v1
  API_BASE_URL: normalizeBase(metaEnv?.VITE_API_URL),

  // Versions and Metadata
  VERSION: '1.0.0',
  ENV: metaEnv?.MODE || 'production',

  // Feature Flags
  OFFLINE_MODE_ENABLED: true,
  VISIT_LOGGING_ENABLED: true,
};

/**
 * Resolve the effective API base at runtime: the user-configured endpoint from
 * storage (popup Settings) wins over the build-time default. Always absolute.
 */
export async function resolveApiBase(): Promise<string> {
  try {
    const stored = await browser.storage.local.get('apiEndpoint');
    const value = (stored as Record<string, unknown>)?.apiEndpoint;
    if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
      return value.trim().replace(/\/+$/, '');
    }
  } catch {
    /* storage unavailable — fall through to default */
  }
  return CONFIG.API_BASE_URL;
}

/** Build an absolute API URL for a path like '/farmers'. */
export async function apiUrl(path: string): Promise<string> {
  const base = await resolveApiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Health endpoint lives at the versioned base (backend serves /api/v1/health). */
export async function healthUrl(): Promise<string> {
  return apiUrl('/health');
}

export default CONFIG;
