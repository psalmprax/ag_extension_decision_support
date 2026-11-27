/**
 * Browser error reporting, so errors that only show in someone's console reach a person.
 *
 * Uncaught errors and unhandled promise rejections are sent to /api/errors (the error
 * boundary already sends its crashes there). The backend counts them per page for the
 * hourly errors-in-production check and forwards them, with their stacks, to Sentry when
 * it is configured. No Sentry code is downloaded to the phone.
 *
 * Reporting never throws, sends each error once and at most ten per page load, and only
 * runs in production builds.
 */
const MAX_REPORTS_PER_PAGE = 10;
/** Browser noise that is not an app fault. */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed$/i, /NetworkError when attempting to fetch/i];

const sent = new Set<string>();

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
}

function describe(reason: unknown): { name: string; message: string; stack?: string } {
  if (reason && typeof reason === 'object') {
    const error = reason as ErrorLike;
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      message: typeof error.message === 'string' ? error.message : String(reason),
      stack: typeof error.stack === 'string' ? error.stack : undefined,
    };
  }
  return { name: 'Error', message: String(reason) };
}

/** Sends one browser error to /api/errors. Returns whether it was sent. */
export function reportBrowserError(source: 'window' | 'promise', reason: unknown): boolean {
  const error = describe(reason);
  const key = `${source}|${error.name}|${error.message}`;
  if (IGNORED.some(pattern => pattern.test(error.message)) || sent.has(key) || sent.size >= MAX_REPORTS_PER_PAGE) return false;
  sent.add(key);
  try {
    void fetch('/api/errors', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, error, url: window.location.href }),
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function startErrorReporting(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  window.addEventListener('error', event => reportBrowserError('window', event.error ?? { name: 'Error', message: event.message }));
  window.addEventListener('unhandledrejection', event => reportBrowserError('promise', event.reason));
}

export function __resetErrorReportingForTests(): void {
  sent.clear();
}
