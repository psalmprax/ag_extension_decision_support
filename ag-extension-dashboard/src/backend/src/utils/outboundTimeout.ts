/**
 * How long a call to another service may take before this server treats that service as
 * unavailable. Without a bound, a provider that accepts the connection and never answers
 * holds the farmer's or officer's request open, and the AI fallback chain never moves on.
 */
function envMs(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Data lookups, messaging and payment APIs. */
export const OUTBOUND_TIMEOUT_MS = envMs('OUTBOUND_TIMEOUT_MS', 15_000);

/** One AI generation request; the provider router falls back to the next provider after it. */
export const AI_PROVIDER_TIMEOUT_MS = envMs('AI_PROVIDER_TIMEOUT_MS', 60_000);

/** The router retries on another provider, so each SDK makes at most one retry of its own. */
export const AI_PROVIDER_MAX_RETRIES = 1;

/** An abort signal for `fetch` that fires after the outbound timeout. */
export function outboundSignal(ms: number = OUTBOUND_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
