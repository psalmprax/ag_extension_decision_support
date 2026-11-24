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

/**
 * A version 4 UUID for a record created on this device, so records saved offline can refer to
 * each other before the server has seen them. Needs Web Crypto, which every supported browser has.
 */
export function newRecordId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = randomHex(16).split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
