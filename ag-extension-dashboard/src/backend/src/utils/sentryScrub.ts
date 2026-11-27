import type { ErrorEvent } from '@sentry/node';
import { withoutPersonalData } from '@/services/failureMonitor';

/**
 * Sentry beforeSend: keeps the error, method, route and status, and drops what could
 * identify a farmer or a session (cookies, headers, bodies, query strings, the user).
 */
export function withoutRequestData(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const url = event.request.url?.split('?')[0];
    event.request = { method: event.request.method, url };
  }
  delete event.user;
  if (event.message) event.message = withoutPersonalData(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = withoutPersonalData(value.value);
  }
  return event;
}
