import axios, { AxiosError } from 'axios';
import { containsDemoId } from '@/demo/demoIds';
import { RemoteWipeService } from '@/services/remoteWipeService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRY_BACKOFF = 2; // Exponential backoff multiplier

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 300000, // Explicitly set 5m timeout for AI/RAG queries on CPU
});

// Request interceptor to add JWT token to all requests
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Hard demo-mode guarantee: demo ids are synthetic and never exist in the live
// DB (farmers.id / fields.farmer_id are UUIDs), so any outbound request that
// carries one is blocked here at the network boundary — no UI code path can
// leak a demo id to the live API, now or in the future.
apiClient.interceptors.request.use(config => {
  if (config.url && containsDemoId(config.url)) {
    return Promise.reject(
      Object.assign(new Error('Request carrying a demo id was blocked before reaching the API'), {
        code: 'ERR_DEMO_BLOCKED',
      })
    );
  }
  return config;
});

const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'delete', 'put']);

function hasIdempotencyKey(config: AxiosError['config']): boolean {
  const headers = (config?.headers ?? {}) as Record<string, unknown>;
  return Object.keys(headers).some(k => k.toLowerCase() === 'idempotency-key' || k.toLowerCase() === 'x-idempotency-key');
}

// Retry configuration for specific HTTP methods and status codes
export const shouldRetry = (error: AxiosError): boolean => {
  const config = error.config;
  if (!config) return false;

  const retryCount = ((config as unknown as Record<string, unknown>).__retryCount as number) || 0;
  if (retryCount >= MAX_RETRIES) return false;

  // Never auto-retry a non-idempotent request (POST/PATCH) unless the caller
  // attached an Idempotency-Key: a 502/504 from a proxy can arrive *after* the
  // server processed the write, and replaying would duplicate SMS/payments/visits.
  const method = (config.method || 'get').toLowerCase();
  if (!IDEMPOTENT_METHODS.has(method) && !hasIdempotencyKey(config)) return false;

  // Only retry on specific status codes (excluding 429 to prevent rate-limit loops)
  const retryStatusCodes = [408, 500, 502, 503, 504];
  if (error.response && retryStatusCodes.includes(error.response.status)) {
    return true;
  }

  // Retry on network errors, but skip timeouts — retrying connection timeouts
  // only adds noise since the server is likely down
  const skipCodes = ['ECONNABORTED', 'ERR_CONNECTION_TIMED_OUT', 'ETIMEDOUT', 'ENOTFOUND', 'ERR_DEMO_BLOCKED'];
  if (!error.response && error.code && skipCodes.includes(error.code)) {
    return false;
  }

  // Retry on other network errors (e.g., transient connectivity blips)
  if (!error.response) {
    return true;
  }

  return false;
};

// Calculate retry delay with exponential backoff
export const getRetryDelay = (retryCount: number): number => {
  return RETRY_DELAY * Math.pow(RETRY_BACKOFF, retryCount);
};

function forceLogout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth-unauthorized'));
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  if (!publicRoutes.includes(window.location.pathname)) {
    window.location.href = '/login';
  }
}

// Single in-flight refresh shared by concurrent 401s.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const current = localStorage.getItem('token');
  if (!current) return null;
  refreshPromise = axios
    .post(`${API_BASE_URL}/auth/refresh`, { token: current }, { withCredentials: true, timeout: 15000 })
    .then(res => {
      const next = (res.data as { data?: { token?: string } })?.data?.token;
      if (typeof next === 'string' && next.length > 0) {
        localStorage.setItem('token', next);
        return next;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/** Check for remote-wipe or account-revocation signals in 403 responses; refresh-then-retry on 401. */
async function handleAuthErrors(error: AxiosError): Promise<unknown> {
  if (error.response?.status === 403) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    RemoteWipeService.evaluateSignal(
      (data as unknown as { error?: string; wipeSignal?: boolean }) || null,
      403
    );
    return Promise.reject(error);
  }

  if (error.response?.status === 401) {
    const config = error.config as (AxiosError['config'] & { __authRetried?: boolean }) | undefined;
    const isAuthEndpoint = /\/auth\/(login|refresh|register|mfa)/.test(config?.url || '');
    if (config && !config.__authRetried && !isAuthEndpoint && localStorage.getItem('token')) {
      const fresh = await tryRefreshToken();
      if (fresh) {
        config.__authRetried = true;
        config.headers = { ...(config.headers as Record<string, string>), Authorization: `Bearer ${fresh}` } as typeof config.headers;
        return apiClient(config);
      }
    }
    forceLogout();
    const nonRetryable = Object.assign(error, { __nonRetryable: true });
    return Promise.reject(nonRetryable);
  }
  return Promise.reject(error);
}

// Global error handler for API calls with retry logic
apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    // Auth errors (401/403) — handle immediately without retry logic
    if (error.response?.status === 401 || error.response?.status === 403) {
      return handleAuthErrors(error);
    }

    const config = error.config;

    // Check if we should retry
    if (config && shouldRetry(error)) {
      const retryCount =
        ((config as unknown as Record<string, unknown>).__retryCount as number) || 0;
      (config as unknown as Record<string, unknown>).__retryCount = retryCount + 1;

      const delay = getRetryDelay(retryCount);        // Retry details remain available through the browser's network tooling without emitting runtime logs.

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the request
      return apiClient(config);
    }

    // Only log warnings in development
    if (import.meta.env.DEV) {
      // Suppress connection errors — expected when backend isn't running
      const silentCodes = [
        'ECONNREFUSED',
        'ERR_CONNECTION_REFUSED',
        'ERR_CONNECTION_TIMED_OUT',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ERR_DEMO_BLOCKED',
      ];
      if (error.code && silentCodes.includes(error.code)) {
        // Silent - backend not running or unreachable
      }
      // Suppress noisy configuration warnings
      else if (
        error.response?.data &&
        (error.response.data as Record<string, unknown>).errorCode ===
          'PAYMENT_GATEWAY_NOT_CONFIGURED'
      ) {
        // Silent - expected setup state
      }
      // API errors are surfaced to the calling feature, which owns user-facing feedback.
    }
    return Promise.reject(error);
  }
);

export default apiClient;
