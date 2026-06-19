# AG-Extension Decision Support Dashboard

## Overview

AI-powered agricultural extension decision support system for field officers and farmers. Full-stack application with React frontend, Express/TypeScript backend, PostgreSQL with pgvector, Redis caching, and multi-provider AI orchestration (OpenAI, Azure, Anthropic, Google Vertex, Ollama).

## Architecture

```
ag-extension-dashboard/          # Main dashboard (monorepo workspace)
├── src/backend/                 # Express + TypeScript API server
│   ├── routes/                  # 27+ API route modules
│   ├── services/                # 40+ business logic services
│   ├── tools/                   # 15+ AI agent tools
│   ├── middleware/              # Auth, rate-limit, validation, security
│   └── workers/                 # Background workers (email, alerts, ingestion)
├── src/frontend/                # Vite + React + TypeScript SPA
│   ├── pages/                   # 20+ page components
│   ├── components/              # 50+ reusable components
│   ├── api/                     # 25+ API client services
│   └── hooks/                   # 10+ custom React hooks
└── src/agents/                  # AI agent runtimes (Agent Zero, Crew AI)

ag-extension-browser-ext/        # WXT browser extension (sibling workspace)
```

## Current State

- **Codebase health:** Fallow maintainability 72.1/100
- **Dead code:** 1,089 issues → ~969 after phase 1 cleanup (20 files deleted)
- **Complexity:** 565/3,741 functions above threshold (15.1%)
- **Circular deps:** 6 cycles in AI provider modules
- **Dupes:** 169 code clone groups
- **UI quality:** 14/24 (audited April 2026)
- **Testing:** Very low — high CRAP scores indicate most complexity is untested
- **Deployment:** Running on 149.104.110.122 (PM2), health degraded (DB/cache OK, AI provider needs keys)

## Recent Work

- ✅ Rebuilt backend dist with agent/nexus routes compiled
- ✅ Fixed database & Redis connectivity (Docker containers on :7501/:7502)
- ✅ Fixed express-rate-limit IPv6 crash (ipKeyGenerator)
- ✅ Nexus engine live testing — 3 agents registered, task dispatch working
- ✅ Phase 1 dead-code cleanup — 20 unused files deleted (51% reduction)

## Milestone: Architecture Hardening v1.1

**Goal:** Raise codebase maintainability from 72.1 → 80+, eliminate circular dependencies, reduce complexity in top hotspots, clean dependency hygiene, and bring UI score to 18+/24.

**Success criteria:**
- Fallow maintainability ≥ 80
- 0 circular dependencies
- Top-5 complexity hotspots refactored (each < 30 cognitive)
- 76 unlisted dependencies resolved
- UI review score ≥ 18/24
- All deployments healthy (DB, cache, AI provider)
- Nexus engine passing integration tests
