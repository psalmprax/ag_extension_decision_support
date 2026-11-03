import { randomUUID, randomBytes } from 'crypto';

let counter = 0;

/**
 * Identifier for request ids, task ids and similar correlation keys.
 *
 * Uses a UUID where available; the remaining paths avoid `Math.random`, whose
 * short ids collide under load and are predictable.
 */
export function randomId(prefix = ''): string {
  let value: string;

  if (typeof randomUUID === 'function') {
    value = randomUUID();
  } else {
    try {
      value = randomBytes(16).toString('hex');
    } catch {
      counter = (counter + 1) % 1_000_000;
      value = `${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
    }
  }

  return prefix ? `${prefix}${value}` : value;
}
