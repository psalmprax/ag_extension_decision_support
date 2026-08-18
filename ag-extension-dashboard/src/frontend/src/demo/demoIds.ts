/**
 * Demo-ID predicates — the single place that knows what a "demo id" looks like.
 *
 * This module is deliberately dependency-free (no store, no api client) so the
 * axios request interceptor in `client.ts` can import it without creating an
 * import cycle. Demo ids are synthetic (`demo-farmer-1`, `field-demo-1`, …)
 * and never exist in the live database (farmers.id / fields.farmer_id are
 * UUIDs), so a request that carries one must be blocked before it hits the
 * network.
 */
const DEMO_ID_PATTERNS: RegExp[] = [
  /demo-farmer-[a-z0-9-]*/i,
  /field-demo-[a-z0-9-]*/i,
  /demo-v\d+/i,
  /demo-r\d+/i,
  /demo-kb/i,
];

/** True when the given id is a known demo identifier. */
export function isDemoId(id?: string | null): boolean {
  return !!id && DEMO_ID_PATTERNS.some(p => p.test(id));
}

/** True when the id is a demo farmer id (e.g. demo-farmer-1). */
export function isDemoFarmerId(id?: string | null): boolean {
  return !!id && /^demo-farmer-/i.test(id);
}

/**
 * True when a URL (path + query) references any demo id. Used by the API
 * client to refuse outbound requests carrying synthetic demo ids, so a demo
 * id can never reach the live backend — regardless of which UI code path
 * initiates the call.
 */
export function containsDemoId(url?: string): boolean {
  if (!url) return false;
  return DEMO_ID_PATTERNS.some(p => p.test(url));
}
