# AG Extension Decision Support - Consolidated Gap Analysis

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
