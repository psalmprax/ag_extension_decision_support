/**
 * Shared frontend constants.
 *
 * Centralizes domain-specific magic numbers so they live in one place instead
 * of being scattered across module-scope declarations and inline closures.
 *
 * Originally hoisted from `pages/SystemHealth.tsx`:
 *   - RATE_LIMIT_STATUS  (was module-scope, line ~323)
 *   - CERT_EXPIRY_WARN_DAYS  (was module-scope, line ~117)
 *   - ERROR_COOLDOWN  (was inside `useSystemHealthData` closure, line ~405)
 */

// HTTP status codes
export const RATE_LIMIT_STATUS = 429; // HTTP 429 Too Many Requests

// UI display thresholds
export const CERT_EXPIRY_WARN_DAYS = 30; // Warn when SSL cert has fewer than this many days remaining

// Behavior timing (milliseconds)
export const ERROR_COOLDOWN_MS = 10000; // 10s cooldown for repetitive error notifications
