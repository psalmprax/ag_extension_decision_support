/**
 * Normalize any API failure into a render-safe display string.
 *
 * The backend has two error shapes: route handlers return
 * `{ success: false, error: "<string>" }` while the global errorHandler
 * returns `{ success: false, error: { message, type } }`. Passing the object
 * form straight into React state crashes with "Objects are not valid as a
 * React child" (React error #31). Always route user-facing error text
 * through here before setState / toast.
 */
const ERROR_KEYS = ['error', 'message', 'msg', 'detail', 'details'];

function asDisplayString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function pickValue(value: unknown, seen: Set<unknown>): string | null {
  const direct = asDisplayString(value);
  if (direct !== null) return direct;
  if (Array.isArray(value)) return pickFromArray(value, seen);
  if (value && typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
    return pickFromRecord(value as Record<string, unknown>, seen);
  }
  return null;
}

function pickFromArray(items: unknown[], seen: Set<unknown>): string | null {
  for (const item of items) {
    const message = pickValue(item, seen);
    if (message) return message;
  }
  return null;
}

function pickFromRecord(record: Record<string, unknown>, seen: Set<unknown>): string | null {
  // Axios-shaped error: prefer the server payload, then the client message.
  if ('response' in record) {
    const data = (record.response as Record<string, unknown> | null)?.data;
    const fromPayload = pickValue(data, seen);
    if (fromPayload) return fromPayload;
  }
  for (const key of ERROR_KEYS) {
    if (key in record) {
      const message = pickValue(record[key], seen);
      if (message) return message;
    }
  }
  return null;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  return pickValue(err, new Set()) ?? fallback;
}
