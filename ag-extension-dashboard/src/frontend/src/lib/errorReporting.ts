/**
 * Browser error reporting, so errors that only show in someone's console reach a person.
 *
 * - Uncaught errors and unhandled promise rejections are sent to /api/errors (the error
 *   boundary already sends its crashes there). The backend counts them per page for the
 *   hourly errors-in-production check.
 * - When the backend has a Sentry DSN, Sentry also starts in the browser and reports
 *   uncaught errors and failed API requests (400 and up, except 401) with a stack trace.
 *
 * Reporting never throws, sends at most a few reports per page load, and only runs in
 * production builds.
 */
import type { ErrorEvent } from '@sentry/react';

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

/** Sentry beforeSend: no user, cookies, headers, bodies or query strings leave the browser. */
export function withoutPrivateData(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) event.request = { url: event.request.url?.split('?')[0], method: event.request.method };
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (typeof breadcrumb.data?.url === 'string') breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
  }
  return event;
}

async function startSentry(): Promise<void> {
  try {
    const response = await fetch('/api/v1/monitoring/browser-config', { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return;
    const config = (await response.json()) as { sentryDsn?: string | null; environment?: string };
    if (!config.sentryDsn) return;
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.environment,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      ignoreErrors: IGNORED,
      integrations: [Sentry.httpClientIntegration({ failedRequestStatusCodes: [[400, 400], [402, 599]], failedRequestTargets: [/\/api\//] })],
      beforeSend: withoutPrivateData,
    });
  } catch (error) {
    console.warn('Error reporting: Sentry could not start', error);
  }
}

export function startErrorReporting(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  window.addEventListener('error', event => reportBrowserError('window', event.error ?? { name: 'Error', message: event.message }));
  window.addEventListener('unhandledrejection', event => reportBrowserError('promise', event.reason));
  void startSentry();
}

export function __resetErrorReportingForTests(): void {
  sent.clear();
}
