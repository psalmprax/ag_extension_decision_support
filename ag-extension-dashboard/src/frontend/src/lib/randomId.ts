let counter = 0;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an identifier that is safe to use for queued mutations, notifications
 * and visit keys.
 *
 * `crypto.randomUUID` is only exposed in secure contexts, and `getRandomValues` in
 * older browsers, so the last resort is a timestamp plus a process-local counter:
 * unique within the session (which is what an idempotency key needs) rather than
 * weakly random.
 */
export function randomId(prefix = ''): string {
  const webCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  let value: string;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    value = webCrypto.randomUUID();
  } else if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    value = randomHex(16);
  } else {
    counter = (counter + 1) % 1_000_000;
    value = `${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
  }

  return prefix ? `${prefix}${value}` : value;
}
