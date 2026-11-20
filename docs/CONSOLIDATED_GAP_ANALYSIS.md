# AG Extension Decision Support - Consolidated Gap Analysis

## November 2026 review: worldwide use, scale and usability

What was found and what changed. Server-side steps are in [SCALING_AND_RESILIENCE.md](SCALING_AND_RESILIENCE.md).

| Gap | Change |
|-----|--------|
| Kenya was assumed in phone numbers, prices, currency, dates and the weather fallback | One country list (53 countries, shared by app and API). Phone numbers are read in the person's country; prices are shown only where they are collected for that country, never another country's; currency, land and temperature units follow the country; time zones are stored per user and organisation and used for SMS dates and working hours. `GET /api/v1/countries` says what each country gets. |
| Officers and managers could see farmers outside their caseload or region on some pages | One access rule (`services/access/farmerScope.ts`) for every farmer list and farmer page. An end-to-end test calls every GET route as an officer, a manager and a farmer from another region and fails on any leak. |
| SMS above the provider rate limit were dropped | Queued and sent when the limit allows. |
| SMS and USSD only in English and Kiswahili | French and Portuguese added (translations need a native-speaker check). |
| 23 app languages | 36: Hausa, Yoruba, Igbo, Amharic, Afaan Oromo, Chichewa, Luganda, Kinyarwanda, Somali, Bengali, Indonesian, Vietnamese and Urdu added; the translate workflow fills them. Arabic and Urdu lay out right to left. |
| Backups only on the same server; never test-restored | Encrypted off-site copies and a restore drill. |
| One backend; uploads on its disk | Optional second backend and object storage, with start-up checks. |
| No outage alert | Uptime workflow. |
| Knowledge guides from one country used as advice in another; officers' uploads used before review | Guides carry their country; an officer's upload waits for a manager or administrator before it grounds answers. |
| Prototype services with invented buyers, dealers and phone numbers | Removed (see [PILLAR_SERVICES_DECISION.md](PILLAR_SERVICES_DECISION.md)). |
| First load fetched the charts bundle | Initial JavaScript cut from about 374 KB to 260 KB gzipped. |

| No proof the service works | Pilots with random assignment, harvests by SMS, advice follow-ups and an export for an evaluator ([GROWTH_AND_EVIDENCE_PLAN.md](GROWTH_AND_EVIDENCE_PLAN.md)). |
| Photo diagnosis never tested | Labelled test set, test runs per crop and problem; only passing pairs reach farmers as "tested". |
| Voice only in English | Recordings per language for the voice line, and voice advisories to a pilot's farmers. |
| Unknown which guides are missing | Content-gap report of questions answered without a vetted guide. |

Still open: SMS cannot carry photos, audio or video (those need WhatsApp, Telegram or a voice line); price collection exists only for Kenya, Uganda, Tanzania and Rwanda; the access test covers GET routes only; `k8s/` is a starting point, not a deployment.

---

## Executive Summary

This document serves as the master source of truth for the Ag-Extension Decision Support project's technical status, implementation progress, and outstanding gaps. As of April 2026, the project has matured significantly, moving from a simulation-heavy prototype to a production-ready platform with approximately **95% real implementation** across core features.

**Key Achievements:**
- Full monetization and billing stack (Phase 8).
- Multi-provider AI Agent integration (Agent Zero, Crew AI).
- Extensive i18n support.
- Containerized microservices architecture.

**Primary Focus Areas:**
1. **Testing Maturity:** Closing the gap on component-level unit tests and code coverage.
2. **AI Monitoring:** Implementing persistence and real-time monitoring for AI agents.
3. **UX Polish:** Refining accessibility and offline synchronization mechanisms.

---

## 1. Project Health Dashboard

| Category | Status | Critical Gaps |
|----------|--------|---------------|
| **Frontend** | ✅ Good | Unit tests, ARIA/Accessibility compliance |
| **Backend** | ✅ Excellent | S3/Object storage for production assets |
| **AI Agents** | ⚠️ Partial | Monitoring (Prometheus), Redis session persistence |
| **Infrastructure** | ✅ Good | Kubernetes (K8s) manifests, CDN configuration |
| **Monetization** | ✅ DONE | Credit system, Promo codes (optional future additions) |
| **Testing** | ⚠️ Partial | Low unit test coverage, CI/CD coverage reporting |
| **Browser Ext** | ⚠️ Partial | Backend integration for AI chat & photo capture |

---

## 2. Domain-Specific Gaps

### 2.1 Backend & Networking
- **Object Storage:** Currently uses local storage with S3 migration tracked in `k8s/` & `uploadService.ts` — S3 ready to wire via `STORAGE_BACKEND=s3`.
- **Request Management:** Explicit timeout middleware in `app.ts:118` (30s default, 300s for AI); API Gateway via Traefik + K8s Ingress `k8s/deployment.yaml`.
- **WebSocket Scaling:** Redis adapter for Socket.IO live in `backend/src/index.ts:97` (`@socket.io/redis-adapter`).
- **Health Monitoring:** Sentry + OpenTelemetry live; Prometheus `/metrics` next milestone.

### 2.2 AI Agents & RAG System
- **Persistence:** Redis-backed state live in `agents/main.py:59` (`RedisSessionManager`) and `agents/crew_main.py` (pooled + Redis health).
- **Monitoring:** Sentry/OTEL live; Prometheus cost/latency metrics queued as next milestone.
- **Callbacks:** Webhook callback field present (`main.py:274` `TaskRequest.callback`) — wiring to caller webhook is backlog.
- **Fallback:** Automated retry with fallback providers live (`aiProvider.ts:65` `getWithFallback` + `omniRouteService.ts:226` free-cascade + 15m blocklist).

### 2.3 Browser Extension
- **Photo Capture / GPS / Sync:** Implemented (`ag-toolbar.content/index.ts:69` camera, `212` GPS, `background/main.ts` IndexedDB queue + AES-GCM); GPS now attached to visit payload (`sidepanel/App.tsx` `location_captured` → `VisitLogger`).
- **Backend Integration:** Chat wired via `apiQueue.makeRequest` with JWT (`shared/apiQueue.ts:152`) to `POST /chatbot/message`; requires extension login token `browser.storage.local.authToken`.
- **Content Scripts:** Page Highlight live (`ag-toolbar.content/index.ts` `highlightTermsOnPage`) + Contextual Action selection bubble; Page Highlight/Selection → sidepanel analysis wired.

### 2.4 Testing & Quality
- **Unit Testing:** 35+ components lack Vitest coverage. Core services are untested.
- **Coverage Reporting:** `test:coverage` script exists but is not integrated into GitHub Actions CI.
- **Visual Regression:** No system to detect UI breakage during styling refactors.
- **Mocking:** MSW (Mock Service Worker) is added but not fully utilized across the test suite.

---

## 3. Dashboard Component Audit (Consolidated)

This table synthesizes findings from three separate UI audits conducted between March and April 2026.

| Priority | Component | Issue | Status/Resolution |
|---|---|---|---|
| **Critical** | Dashboard Stats | Hardcoded fallbacks (`?? 0` was missing) | **✅ Resolved** (Apr 2026) |
| **Critical** | Report Actions | Cards were not clickable; no download flow | **✅ Resolved** |
| **Critical** | Visit Status | No buttons for Complete/Cancel | **✅ Resolved** |
| **High** | Accessibility | Missing ARIA labels and focus trapping | ⚠️ Partial - Manual audit needed |
| **High** | Keyboard Shortcuts | Documented but not wired | **✅ Resolved** (Ctrl+K, Ctrl+B) |
| **High** | Raw `fetch()` | 8+ places bypassed `apiClient` | **✅ Resolved** (Migrated to services) |
| **High** | Offline Sync | `pendingSyncCount` unused | **✅ Resolved** (Implemented IndexedDB) |
| **Medium** | Farmer Yield | Chart breaks on empty data | **✅ Resolved** (Graceful handling) |
| **Medium** | Reset Password | Flow was missing entirely | **✅ Resolved** (Full flow added) |
| **Medium** | Notifications | Store vs API count mismatch | **✅ Resolved** (Unified via API) |
| **Low** | Map Legend | Static dots | Planned: Dynamic status colors |

---

## 4. Priority Roadmap

### 4.1 Phase 1: Critical (Next 2-4 Weeks)
- [ ] **Testing:** Implement unit tests for core `apiClient` and `authService`.
- [ ] **AI Persistence:** Integrate Redis state management for Agent Zero.
- [ ] **Browser Integration:** Connect Extension Chat UI to real backend endpoints.

### 4.2 Phase 2: High (Next 1-2 Months)
- [ ] **A11y:** Conduct full WCAG 2.1 compliance audit and fix ARIA gaps.
- [ ] **Monitoring:** Set up Prometheus for Agent monitoring and Sentry for error tracking.
- [ ] **Infra:** Add CDN configuration and S3 upload service.

### 4.3 Phase 3: Medium (Future)
- [ ] **Monetization:** Add credit-based billing system for pay-as-you-go users.
- [ ] **Scaling:** Implement Redis adapter for Socket.IO scaling.
- [ ] **Extension:** Implement GPS and Photo Capture features in the Browser Extension.

---
*Updated 2026-09-01: storage, timeout, WebSocket, RAG fallback, extension GPS/photo/auth, and highlight gaps closed as above.*

*Document consolidated on April 7, 2026, from 7 legacy source files.*
