# ADR-001: TOTP Stays a Single Audited Implementation (otplib as Conformance Verifier)

Date: 2026-09-14. Status: accepted. Context: `services/mfaService.ts` implements RFC 6238 TOTP by hand.

## Decision

Keep the single in-repo implementation as the production path. Use `otplib` (devDependency, test-only) as a conformance verifier, not a second runtime path.

## Rationale

1. **Explicit-timestamp verification is load-bearing.** Replay protection (`matchTotpStep`) verifies codes against adjacent time steps, and tests pin exact timestamps. `otplib` v12 verifies only against wall-clock time — it cannot serve these paths without global `Date` mocking in production code.
2. **Dual crypto paths double audit surface.** Two implementations that must agree on truncation, windowing, and constant-time comparison create disagreement bugs worse than the single-implementation risk.
3. **Equivalence is proven, not asserted.** `securityHardening.test.ts` pins RFC 6238 Appendix B SHA-1 vectors (287082 / 081804 / 050471 / 005924 / 279037) and runs a live two-direction interop test against `otplib` (`TOTP` + Noble/Scure plugins).

## Hardening already applied

Strict Base32 (rejects invalid input), 80-bit minimum key with fail-closed verify on malformed secrets, constant-time comparison, cross-step replay rejection via persisted step.

## Residual risks accepted

No fuzzing run yet; side-channel review outstanding. Revisit if authenticator-app interop reports arrive or if explicit-timestamp verification is ever removed (then swap to `otplib` outright and delete the custom path).

## Fuzz note (open)

- Harness: feed `base32Decode` + `generateTotpCode` random/mutated inputs (valid alphabet, invalid chars, empty, oversized) asserting fail-closed behavior (throw or null/false, never a code) — no crash, no hang, no valid code from invalid input.
- Owner: backend security owner; run before any authenticator-related change and attach the seed + corpus size to the change.
- Not yet run — tracked here so the residual above stays visible.
