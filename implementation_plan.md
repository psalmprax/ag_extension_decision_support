# Implementation Plan: Platform Hardening and Product Alignment

## Objective

Raise the platform from a feature-rich pilot to a trustworthy, globally configurable agricultural decision-support foundation without expanding unsupported claims. Preserve the existing landing/demo edits already present in the working tree.

## Agreed Direction

- **Product focus:** Global platform foundation.
- **Delivery model:** Parallel workstreams with shared contracts and integration gates.
- **Primary operational workflow:** Officer selects farmer → records a visit online or offline → receives evidence-backed AI guidance → schedules follow-up → syncs reliably → supervisor reviews outcomes.
- **Production rule:** Synthetic/demo data must be explicitly labeled and must never silently appear as live operational data.

## Non-goals for this cycle

- Adding more AI providers or new social channels before existing integrations are trustworthy.
- Claiming country-specific regulatory compliance without validated jurisdictional data and review.
- Rebuilding the entire UI or changing the visual identity wholesale.
- Deploying or changing production infrastructure during implementation.

## Workstreams

### Workstream A — Product scope, region, and provenance

**Purpose:** Remove global/Africa/Canada persona and messaging ambiguity while retaining configurable regional support.

**Files:**
- `README.md`
- `docs/PRODUCT_SCOPE.md` (new)
- `ag-extension-dashboard/src/frontend/src/pages/LandingPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/DemoPage.tsx`
- `ag-extension-dashboard/src/frontend/src/config/navItems.ts`
- `ag-extension-dashboard/src/backend/src/config/index.ts`
- `ag-extension-dashboard/src/backend/.env.example`
- `ag-extension-dashboard/src/frontend/src/lib/realFirst.ts`
- `ag-extension-dashboard/src/frontend/src/App.tsx`

**Changes:**
- Define tenant/region configuration rather than hardcoded country assumptions.
- Add a single source-of-truth product vocabulary for product name, primary personas, and supported regions.
- Label demo, cached, simulated, AI-generated, and live data states in the UI.
- Remove fabricated production-looking metrics from normal authenticated empty states.
- Keep demo routes isolated from authenticated production routes.

**Acceptance criteria:**
- A new tenant can select region, currency, language, and enabled capabilities without source edits.
- No authenticated page presents synthetic farmer counts, yield gains, or reports as live data.
- Demo pages visibly identify simulated content.

### Workstream B — Core workflow and data trust

**Purpose:** Make the officer workflow dependable and auditable.

**Files:**
- `ag-extension-dashboard/src/backend/src/routes/visits.ts`
- `ag-extension-dashboard/src/backend/src/routes/reporting.ts`
- `ag-extension-dashboard/src/backend/src/routes/analytics.ts`
- `ag-extension-dashboard/src/backend/src/routes/knowledge.ts`
- `ag-extension-dashboard/src/backend/src/services/knowledgeService.ts`
- `ag-extension-dashboard/src/backend/src/services/ragV2Service.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/types.ts`
- `ag-extension-dashboard/src/frontend/src/pages/VisitsPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/DiseaseDiagnosis.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/ReportsPage.tsx`
- `ag-extension-dashboard/src/frontend/src/components/KnowledgeBase.tsx`
- `ag-extension-dashboard/src/frontend/src/types/` (only focused type additions)
- `ag-extension-dashboard/src/backend/prisma/schema.prisma`
- `ag-extension-dashboard/src/backend/prisma/migrations/` (Prisma migrations only)

**Changes:**
- Add structured provenance to AI recommendations: source, source timestamp, region, model, confidence, and generated time.
- Add explicit low-confidence/needs-review states and escalation paths.
- Ensure disease and treatment guidance includes safe-use disclaimers and expert-review status.
- Persist recommendation/audit metadata without storing unnecessary sensitive prompt content.
- Replace fabricated analytics fallbacks with honest empty/loading/error states.
- Add immutable or append-only audit records for critical recommendations and visit state changes.

**Acceptance criteria:**
- Every AI recommendation shown to an officer has evidence metadata or an explicit “general guidance/no verified source” state.
- Low-confidence diagnosis cannot appear as a definitive diagnosis.
- Reports generated with unavailable data show incomplete-data status instead of invented metrics.

### Workstream C — Offline-first synchronization

**Purpose:** Make offline operation safe for field use rather than merely queueing arbitrary HTTP requests.

**Files:**
- `ag-extension-browser-ext/shared/apiQueue.ts`
- `ag-extension-browser-ext/entrypoints/background/main.ts`
- `ag-extension-browser-ext/entrypoints/sidepanel/components/VisitLogger.tsx`
- `ag-extension-browser-ext/entrypoints/sidepanel/App.tsx`
- `ag-extension-browser-ext/shared/` (focused queue payload/type module if needed)
- `ag-extension-dashboard/src/backend/src/routes/visits.ts`
- `ag-extension-dashboard/src/backend/src/routes/extensionSync.ts` (new if required by existing route conventions)
- `ag-extension-dashboard/src/backend/src/middleware/` (idempotency/auth handling as needed)
- `ag-extension-dashboard/src/backend/prisma/schema.prisma`
- `ag-extension-dashboard/src/backend/prisma/migrations/`

**Changes:**
- Queue domain commands, not arbitrary serialized `Request` objects.
- Support JSON visit records and photo references with explicit upload states.
- Add idempotency keys, retry classification, conflict handling, and per-item sync status.
- Ensure delayed replay uses current authentication and does not duplicate visits.
- Add bounded local storage, encryption strategy documentation, and user-visible failed-sync recovery.
- Add a minimal downloadable/offline knowledge pack or clearly communicate which capabilities are unavailable offline.

**Acceptance criteria:**
- A visit created offline is replayed exactly once after reconnection.
- Failed items remain inspectable and retryable rather than silently disappearing.
- Photo attachments never become invalid JSON or falsely report success.
- Offline behavior has automated unit tests and a browser-level smoke test.

### Workstream D — Security and governance

**Purpose:** Close authorization, data protection, and sensitive integration risks.

**Files:**
- `ag-extension-dashboard/src/backend/src/routes/canadianServices.ts`
- `ag-extension-dashboard/src/backend/src/routes/upload.ts`
- `ag-extension-dashboard/src/backend/src/routes/farmers.ts`
- `ag-extension-dashboard/src/backend/src/routes/knowledge.ts`
- `ag-extension-dashboard/src/backend/src/middleware/authorize.ts`
- `ag-extension-dashboard/src/backend/src/middleware/securityGate.ts`
- `ag-extension-dashboard/src/backend/src/services/auditService.ts` (new only if no suitable service exists)
- `ag-extension-dashboard/src/backend/src/schemas/`
- `ag-extension-dashboard/src/backend/prisma/schema.prisma`
- `ag-extension-dashboard/src/backend/prisma/migrations/`
- `ag-extension-dashboard/src/backend/.env.example`

**Changes:**
- Add explicit authentication and role checks to Canadian/governance endpoints or clearly mark them as internal-only.
- Validate all sensitive payloads with existing Zod conventions.
- Verify tenant and officer ownership on farmer, visit, report, memory, and share access.
- Add farmer data export/deletion and consent/audit lifecycle where the current domain permits it.
- Enforce upload size/type/content validation and prepare an object-storage adapter boundary.
- Remove default production secrets and unsafe permissive defaults.

**Acceptance criteria:**
- Unauthenticated requests to sensitive governance and farmer-data endpoints are rejected.
- Cross-tenant and cross-officer access tests fail closed.
- Uploads cannot execute or render active content.
- Security-sensitive actions produce audit records.

### Workstream E — Real integrations and truthful degradation

**Purpose:** Prevent mock behavior from masquerading as delivery success.

**Files:**
- `ag-extension-dashboard/src/backend/src/services/whatsappService.ts`
- `ag-extension-dashboard/src/backend/src/services/socialIntelligenceAgent.ts`
- `ag-extension-dashboard/src/backend/src/services/tavilyService.ts`
- `ag-extension-dashboard/src/backend/src/routes/whatsapp.ts`
- `ag-extension-dashboard/src/backend/src/routes/external.ts`
- `ag-extension-dashboard/src/backend/src/services/marketPriceService.ts`
- `ag-extension-dashboard/src/backend/.env.example`
- Relevant backend integration tests under `ag-extension-dashboard/src/backend/src/__tests__/`

**Changes:**
- Return explicit `not_configured`, `queued`, `logged`, `sent`, and `failed` states for outbound messaging.
- Do not dispatch alerts based on mock social posts in production.
- Add source timestamps, provider names, and stale-data indicators to market/weather/social data.
- Add provider contract tests and deterministic local test adapters.
- Add timeouts, retry policy, and rate-limit handling at integration boundaries.

**Acceptance criteria:**
- An unconfigured WhatsApp provider cannot return a production “sent” result.
- Mock data is available only in explicit demo/test mode.
- External data responses expose source and freshness metadata.

### Workstream F — Observability, AI operations, and storage readiness

**Purpose:** Make failures and costs visible before scaling.

**Files:**
- `ag-extension-dashboard/src/backend/src/app.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/aiProvider.ts`
- `ag-extension-dashboard/src/backend/src/services/agentOrchestrator.ts`
- `ag-extension-dashboard/src/backend/src/services/selfHealing.ts`
- `ag-extension-dashboard/src/backend/src/routes/systemHealth.ts`
- `ag-extension-dashboard/src/backend/src/services/usageService.ts`
- `ag-extension-dashboard/src/backend/src/services/uploadService.ts` (or existing upload service)
- `ag-extension-dashboard/src/backend/src/utils/logger.ts`
- `docs/OBSERVABILITY.md` (new)

**Changes:**
- Track provider/model, latency, token usage, cost estimate, retries, and fallback reason.
- Persist agent task state and status transitions where current workers require restart recovery.
- Replace placeholder manual recovery endpoint behavior with either a real bounded action or remove the endpoint.
- Add correlation IDs across HTTP, queue, agent, and AI provider calls.
- Define object-storage and CDN interfaces without requiring a provider selection yet.
- Refactor `usageService.ts` to remove the current lint complexity failure.

**Acceptance criteria:**
- An AI request can be traced from API request through provider fallback and final response.
- Admin health views distinguish dependency failure from degraded fallback operation.
- Agent and AI cost/error metrics are queryable.
- Backend lint passes without disabling the complexity rule.

### Workstream G — Accessibility, performance, and extension quality

**Purpose:** Make the user-facing product usable on low-bandwidth devices and assistive technology.

**Files:**
- `.github/workflows/ci-cd.yml`
- `ag-extension-browser-ext/package.json`
- `ag-extension-browser-ext/tsconfig.json`
- `ag-extension-browser-ext/wxt.config.ts`
- `ag-extension-browser-ext/entrypoints/`
- `ag-extension-dashboard/src/frontend/vite.config.*`
- `ag-extension-dashboard/src/frontend/src/components/`
- `ag-extension-dashboard/src/frontend/src/pages/`
- `ag-extension-dashboard/src/frontend/tests/`
- `docs/ACCESSIBILITY.md` (new)

**Changes:**
- Repair and lock the extension dependency/build path.
- Add extension typecheck/build to CI.
- Add route-based and vendor chunk optimization to reduce the current large JavaScript chunks.
- Run axe-style accessibility checks plus keyboard/focus/manual smoke coverage for auth, farmer, visit, diagnosis, and report workflows.
- Replace production console usage with the established logging/error-reporting strategy where applicable.
- Fix lint warnings and React test warnings.

**Acceptance criteria:**
- Dashboard and extension builds pass in clean CI installs.
- Main dashboard chunks are reduced or consciously budgeted with documented limits.
- Core workflows pass keyboard and screen-reader smoke checks.
- No new lint warnings are introduced.

## Test strategy

### Unit and contract tests
- Fix `ag-extension-dashboard/src/frontend/src/__tests__/authService.test.ts` mock isolation so no test makes a real request.
- Add tests for provenance states, demo/live boundaries, offline command serialization, idempotency, retry classification, authorization, and truthful integration statuses.
- Add backend tests for each changed route and service boundary.

### Integration tests
- Run backend route tests with isolated PostgreSQL/Redis services.
- Verify tenant ownership and role enforcement with officer, manager, admin, and farmer fixtures.
- Verify AI provider fallback metadata and failure behavior.

### Browser/E2E tests
- Login/register/logout.
- Farmer selection and visit creation.
- Offline visit queue and reconnection replay.
- Diagnosis/recommendation evidence display.
- Report generation with empty, partial, and live data.
- Extension popup → sidepanel → visit logging flow.

### Required verification commands

```bash
npm run lint
npm run test:e2e

cd ag-extension-dashboard/src/frontend
npm run typecheck
npm run lint
npm run test
npm run build

cd ../backend
npm run lint
npm run test
npm run build

cd ../../../ag-extension-browser-ext
npm run build
```

## Delivery waves

1. **Wave 1 — Contracts and safety:** product scope, live/demo boundary, authorization audit, failing auth tests, backend lint.
2. **Wave 2 — Core workflow:** provenance, honest empty states, recommendation audit, report correctness.
3. **Wave 3 — Offline reliability:** domain command queue, idempotency, photo handling, replay/conflict tests.
4. **Wave 4 — Integrations and operations:** truthful WhatsApp/social/market states, observability, agent recovery, storage boundary.
5. **Wave 5 — UX and release gates:** accessibility, performance, extension build/CI, E2E coverage, final review.

Each wave must pass its own unit/integration checks before the next wave is merged. Parallel workstreams may be developed independently, but integration only occurs through the shared types, status contracts, migrations, and E2E workflow tests.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope expands while making the platform global | Region/persona/capability configuration is defined before UI expansion |
| Existing demo behavior breaks investor previews | Keep explicit `/demo` routes and test fixtures separate from authenticated production flows |
| Offline migration creates duplicate records | Idempotency keys, server uniqueness, replay tests, and inspectable queue states |
| AI output becomes slower with provenance | Cache retrieval metadata and measure end-to-end latency before/after |
| Schema changes drift across environments | Use Prisma migrations and run schema checks in CI |
| Parallel workstreams conflict | Shared status/provenance/offline contracts reviewed before implementation |

## Approval gate

Do not begin production implementation until the user approves this plan and any remaining scope decisions. After approval, implement Wave 1 first, write tests alongside each change, and report verification results before proceeding to the next wave.
