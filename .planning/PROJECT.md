# AG-Extension Decision Support Dashboard

## Overview

AI-powered agricultural extension decision support system for field officers and farmers. Full-stack monorepo with a React frontend, Express/TypeScript backend, PostgreSQL with pgvector, Redis caching, and multi-provider AI orchestration (OpenAI, Groq, Azure OpenAI, Google Vertex, Anthropic, Ollama).

## Architecture

```
ag-extension-dashboard/            # Main dashboard (monorepo workspace)
├── src/backend/                   # Express + TypeScript API server
│   ├── routes/                    # 39 API route modules
│   ├── services/                  # 76 business logic services
│   ├── tools/                     # 22 AI agent tools (MCP)
│   ├── middleware/                # 11 middleware modules (auth, rate-limit, security)
│   └── workers/                   # 3 background workers (email, alerts, ingestion)
├── src/frontend/                  # Vite + React + TypeScript SPA
│   ├── pages/                     # 21 pages + diagnostics suite
│   ├── components/                # 98 reusable components
│   ├── hooks/                     # 19 custom React hooks
│   └── api/                       # 32 API client services
└── src/agents/                    # Python AI agent runtimes (Agent Zero, Crew AI)

ag-extension-browser-ext/          # WXT browser extension, Manifest V3 (sibling workspace)
ag-extension-shared/               # Shared zod schemas — frontend/backend API contract
```

## Current State (verified 2026-08-18)

- **Fallow maintainability:** 88.7/100 (good) — health score 84/B
- **Codebase size:** 79,951 LOC analyzed
- **Dead code:** 7.0% dead files · 9.2% dead exports (29 files, 92 exports, 23 types)
- **Duplication:** 5.3% (4,222 lines across 100 files)
- **Complexity:** 227 large functions (>60 LOC) · 740 functions above complexity threshold
- **Circular deps:** 0
- **Tests:** 454 passing across all layers — backend 346 (40 suites), frontend 103 (23 files), Python agents 5
- **Type safety:** `tsc --noEmit` clean in both backend and frontend
- **Lint:** ESLint clean in both backend and frontend (sonarjs complexity gate at 15)
- **Dependency audit:** frontend 0 vulns; backend audit currently blocked by an `uuid` override conflict in `package.json` (see Known Issues)
- **Repo hygiene:** committed tool-run debris removed and gitignored (2026-08-18)

## Milestone Status

- **Architecture Hardening v1.1** — complete (see `MILESTONE-v1.1-COMPLETE.md`)
- **Code Health Sprint v1.3** — phases 6A (dead code), 6B (complexity decomposition), 6C (clone elimination) complete; 6D (coupling reduction) pending
- **Architecture Hardening v1.2** (API standardization, error handling, performance, state consolidation, test coverage) — planned but superseded by the v1.3 code-health sprint; not executed

See `STATE.md` and `ROADMAP.md` for phase detail.

## Known Issues

- **Backend dependency audit blocked:** `npm audit` fails with `EOVERRIDE — Override for uuid@^9.0.1 conflicts with direct dependency`.
- **Complexity hotspots remain:** `FarmerMap.tsx` (cognitive 61, 839 LOC), browser-extension sidepanel `App.tsx` (cognitive 47), `CropsFields.tsx` (cognitive 35, 811 LOC), and `LandingPage.tsx` (1,316 LOC) top the list of untested, high-CRAP functions.
- **Test coverage is thin at the UI layer:** most of the high-CRAP findings carry `coverage_tier: none`.
- **E2E (Playwright) is configured but not yet wired into a CI gate.**

## Recent Work

- ✅ Fixed frontend typecheck error (`nav.connection` narrowing) — build gate green
- ✅ Refactored 8 backend hotspots to pass the sonarjs complexity gate (bootstrap, health handlers, AI providers, FAOSTAT, security guards) — lint green
- ✅ Removed 21 committed debris files (numeric artifacts, logs, lint snapshots) and added gitignore rules
- ✅ Demo mode centralized behind `@/demo` with a network-boundary demo-ID guard
- ✅ Frontend/backend API contract codified in `@ag-extension/shared` zod schemas
- ✅ Deep-tier resilience: agronomic safety guardrails, offline CRDT conflict resolution, hardware budgets
- ✅ Security suites + CI security pipeline (see `docs/CYBERSECURITY_CHECKLIST.md`)
