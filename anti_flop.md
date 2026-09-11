---
name: anti-flop
description: >-
  Prevents execution failures, partial implementations, test regressions, breaking changes,
  and fragile code across the Agri-Extension Decision Support platform. Enforces production
  rigor, offline resilience, thorough testing, and container stability.
  Use whenever executing code modifications, fixing bugs, refactoring, or preparing deployments.
---

# Anti-Flop Protocol (AG-SKILL-AF-01)

This protocol governs execution excellence, change resilience, and failure prevention across all components of the **Agri-Extension Decision Support Platform** (Backend, Dashboard Frontend, Mobile/PWA, Browser Extension, Shared Contracts, and Autonomous AI Agents).

A **flop** is an incomplete implementation, an introduced regression, a broken build, a stubbed response masquerading as real code, an unhandled runtime error, an abandoned edge-case, unhandled offline state, or a fragile fix that only passes under synthetic happy-path conditions. This protocol eliminates flops through rigorous engineering discipline.

---

## 1. The Six Anti-Flop Non-Negotiables

### 1. Zero Regressions
- Any code modification that breaks an existing unit, integration, or e2e test is a failure.
- Run baseline test suites before editing, and re-run after every edit:
  - Backend: `npm run test:backend`
  - Frontend: `npm run test:frontend`
  - Browser Extension: `cd ag-extension-browser-ext && npm test`
  - Python Agents: `npm run security:test:agents` (or `pytest` in `ag-extension-dashboard/src/agents`)
  - Full suite: `npm test`
- Fallow dead-code regression baseline must remain valid: `npm run fallow:check`.

### 2. No Superficial Stubs or Half-Implementations
- Never leave `TODO`, `FIXME`, dummy return values, or empty placeholder methods when implementing a feature or fixing a bug.
- Express API endpoints must interact with actual database services (`databaseService.ts` / Prisma) or real downstream clients, not static `{ success: true }` mocks.
- Agent tools in `ag-extension-dashboard/src/agents/tools` must execute real retrieval, web, or calculation logic; never return static dummy strings.
- Frontend components must implement comprehensive UI state handling: **loading**, **error**, **empty**, **offline**, and **data** states.

### 3. Complete CI Green Compliance
- Never skip, comment out, or disable CI gates or husky hooks (`.husky/pre-commit`, `.husky/pre-push`).
- All build, lint, and security checks must execute with exit code 0:
  - Strict TypeScript compilation: `npm run build:backend` and `npm run build:frontend`.
  - Linting: `npm run lint` (`npm run lint:backend` + `npm run lint:frontend`).
  - Security gates: `npm run security:test` and `npm run security:audit`.
  - Database schema integrity: `npm run check:drift` and `scripts/prisma-migration-replay-check.cjs`.
  - Shared contract sync: `npm run shared:check`.

### 4. Zero-Connectivity & Edge Resilience (Zero-Conn Field Edge)
- Agricultural field extension workers operate in rural areas with erratic or zero cellular network access.
- Client applications (PWA, mobile iOS/Android wrappers, browser extension) must **fail gracefully offline**:
  - Store offline state in IndexedDB, SQLite, or persistent local storage.
  - Queue mutations for optimistic update and replay when connectivity is restored.
  - Never crash the UI or throw unhandled promise rejections on network timeout/disconnection (`ERR_INTERNET_DISCONNECTED`, `ETIMEDOUT`).

### 5. Resource Protection & Scale Safety
- **Media & Audio Streaming**: Voice notes (Whisper STT) and high-resolution crop imagery must be streamed in chunks (using streams or presigned S3 URLs via `@aws-sdk/client-s3`), never buffered monolithically in memory.
- **Queue Limits**: BullMQ workers and Redis queues must specify concurrency limits, TTLs, and job eviction policies to avoid Redis memory exhaustion.
- **Geospatial & Spatial Calculations**: WGS-84 polygon acreage calculations and GeoJSON spatial lookups must avoid $O(N^2)$ brute-force intersection loops; use spatial indexing (e.g. PostGIS indexes, R-tree bounds).
- **Rate Limiting & Token Budgets**: All LLM queries (Gemini, Anthropic, Groq) and external weather API calls (Open-Meteo, NOAA) must be wrapped in rate limiters, retries with exponential backoff, and caching layers (`semanticCacheService.ts`).

### 6. Git Hygiene & Branch Protection
- In accordance with the project constitution (`CLAUDE.md`):
  - Local feature development is executed on the local `stage` branch.
  - Verified changes are merged locally into `master`.
  - Remote synchronization pushes ONLY to remote `stage` (`git push origin stage`). Never push directly to remote `master`.

---

## 2. Eradication of Common Flop Anti-Patterns

| Flop Anti-Pattern | Root Risk | Anti-Flop Resolution |
| :--- | :--- | :--- |
| **Silent Catch Blocks (`catch (e) {}`)** | Swallows errors, leading to phantom bugs and silent data corruption. | Catch typed errors, log with Winston/Pino logger with trace ID, and return proper HTTP error codes (4xx/5xx). |
| **Monolithic File/Audio Buffering** | Out-of-memory (OOM) crashes during large voice note or drone image upload. | Stream data directly to S3/MinIO using `Upload` stream or presigned URLs. |
| **Stubbed API Endpoints** | Breaks integration tests and misleads downstream clients. | Implement real Prisma queries, service calls, and full input validation with Zod. |
| **Unvalidated External Payloads** | Injection attacks, schema mismatch crashes, malformed weather/satellite data. | Validate all incoming payloads with Zod schemas in `ag-extension-shared`. |
| **Unhandled Async Promises** | Node.js process crashes via `unhandledRejection`. | Always await promises or chain `.catch()`; ensure Express async route handlers use proper error middleware. |
| **Direct DB State Mutation Without Transactions** | Orphaned records or corrupted state during multi-step updates (e.g. credit/carbon issuance). | Wrap multi-table operations in `prisma.$transaction([...])`. |
| **Bypassing Shared Link** | Frontend and backend drift on API contracts and data models. | Always verify contract parity with `npm run shared:check` before pushing. |

---

## 3. Pre-Flight and Post-Flight Verification Checklist

Before declaring any change complete, run the strict verification pipeline in this order:

```bash
# 1. Verify shared contract sync
npm run shared:check

# 2. Typecheck and lint
npm run lint

# 3. Backend, Frontend, and Browser Extension Unit Tests
npm run test:backend
npm run test:frontend
cd ag-extension-browser-ext && npm test && cd ..

# 4. Agent & Security Test Suite
npm run security:test

# 5. Dead Code & Fallow Regression Check
npm run fallow:check

# 6. Database Schema Drift Verification
npm run check:drift

# 7. Production Build Verification
npm run build
```

---

## 4. Self-Healing & Diagnostic Protocol

When a test, build, or container fails during development:
1. **Never suppress, comment out, or delete the test**.
2. Read the full error stack and traceback to identify the exact file, line number, and offending variable or type.
3. Compare against canonical schemas in `ag-extension-dashboard/src/backend/prisma/schema.prisma` and `ag-extension-shared/src`.
4. Validate environment configurations against `.env.example`.
5. Fix the underlying root cause cleanly, adhering to Karpathy's rule of **surgical changes only**.
