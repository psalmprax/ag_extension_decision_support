# Engineering Quality Plan: 9.5/10 Target

## Goal
Raise the project from its current implementation-based rating of 7.5/10 toward a defensible 9.5/10 by improving verified production quality rather than adding surface-area features.

## Baseline observed
- Frontend: 136 tests passed; lint and production build passed.
- Backend: 456 tests passed across 53 suites; lint and TypeScript build passed.
- Browser extension: typecheck and Chrome production build passed.
- Frontend bundle-budget check failed: total assets were 4,370.7 KB against a 4,096 KB budget.
- Frontend coverage was 10.67% statements, 7.18% branches, 9.3% functions, and 10.94% lines.
- Runtime and supporting code contain numerous explicit `any` types and `console.log` calls.
- Locale validation passed structurally but reported 109 English fallback values, 17 high priority.

## Priorities

### P0 — Release gates and trustworthy verification
1. Make the frontend bundle budget pass by reducing shipped assets through route/component lazy loading, vendor splitting, and removal of unnecessary eager imports. Preserve functionality and validate with the existing bundle checker.
2. Add meaningful coverage thresholds or scoped coverage gates for critical services, hooks, state transitions, authentication, sync/offline behavior, and key user journeys. Avoid inflating metrics with shallow tests.
3. Add/strengthen browser-extension tests for message routing, persistence, queue replay, permissions, and failure behavior.
4. Add end-to-end smoke coverage for authentication, dashboard loading, farmer/field workflows, diagnosis, offline recovery, and error states.

### P1 — Type safety and runtime correctness
1. Replace production-path `any` types in backend routes, workers, diagnostics, provider adapters, and browser-extension message handlers with explicit interfaces, `unknown` plus narrowing, or Zod schemas already used by the project.
2. Remove unsafe schema internals and unchecked casts where practical, especially validation middleware and external API response handling.
3. Standardize typed API contracts between frontend, backend, shared package, and extension messaging.
4. Add negative-path tests for malformed requests, provider failures, stale/offline data, authorization boundaries, and partial external responses.

### P1 — Operational quality and security
1. Replace runtime `console.log` calls with the existing Winston/logger abstraction; keep console output only in intentionally standalone CLI scripts and migrations where appropriate.
2. Ensure logs redact tokens, credentials, personal data, and raw external payloads.
3. Run dependency/security checks and address high-severity findings without introducing unverified upgrades.
4. Verify graceful startup/shutdown, health checks, timeouts, retries, idempotency, and queue failure handling through tests.

### P2 — Product polish and maintainability
1. Translate the 17 high-priority English fallback values and reduce the remaining fallbacks where accurate translations are available.
2. Split oversized UI modules and pages into focused components/hooks while preserving behavior.
3. Improve accessibility coverage for keyboard navigation, focus management, labels, dialogs, loading/error states, and map fallbacks.
4. Add performance checks for initial load, route transitions, large lists, maps, charts, and offline cache behavior.
5. Run fallow/audit checks and remove only verified dead code, duplicate paths, and unused dependencies.

## Proposed execution order
1. Establish scoped quality gates and capture current metrics.
2. Fix bundle budget and eager-loading boundaries.
3. Add critical-path integration/E2E and extension coverage.
4. Type hardening in highest-risk runtime boundaries.
5. Logging/redaction and security hardening.
6. Translation, accessibility, maintainability, and cleanup pass.
7. Re-run all tests, builds, lint, typechecks, security checks, fallow, and bundle checks.

## Success criteria
- Frontend bundle check passes without raising the budget.
- Frontend critical-path coverage is materially improved with meaningful assertions; thresholds are enforced for the selected scope.
- Backend, frontend, shared package, and extension tests/typechecks/builds pass.
- No new production-path explicit `any` or unstructured message payloads in touched boundaries.
- No unreviewed runtime console logging or sensitive-data leakage.
- High-priority translation fallbacks are eliminated or explicitly justified.
- Accessibility and E2E smoke checks pass.
- Fallow/security audits show no newly introduced regressions.

## Open decision
This is a multi-pass quality program. User approval is required before implementation begins, and the work should be executed in prioritized batches with verification after each batch.
