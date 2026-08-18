# Ag-Extension Decision Support Dashboard

An AI-powered agricultural extension platform that gives field officers and farmers real-time insights: disease monitoring, weather forecasting, market intelligence, personalized recommendations, and visit coordination.

## Repository layout

```
ag-extension-dashboard/        # Main application
├── src/backend/               # Express + TypeScript API server
│   ├── routes/                # 39 route modules
│   ├── services/              # 76 business-logic services (AI, security, data)
│   ├── tools/                 # 22 agricultural AI tools (MCP)
│   ├── middleware/            # Auth, rate-limit, security gate, validation
│   └── workers/               # Background workers (email, alerts, ingestion)
├── src/frontend/              # Vite + React + TypeScript SPA
│   ├── pages/                 # 21 pages + diagnostics suite
│   ├── components/            # 98 components
│   ├── hooks/                 # 19 custom hooks
│   └── api/                   # 32 API client modules
└── src/agents/                # Python AI agent runtimes

ag-extension-browser-ext/      # WXT browser extension (Manifest V3)
ag-extension-shared/           # Shared zod schemas — frontend/backend API contract
```

## Features

- **AI chat** — conversational assistant for agricultural queries, with multi-provider fallback (OpenAI, Groq, Azure OpenAI, Google Vertex, Anthropic, Ollama)
- **Disease monitoring** — AI plant disease detection, quarantine escalation, and alerts
- **Weather & market intelligence** — localized forecasts and commodity price analysis
- **Visit scheduling** — farmer visit coordination and reporting
- **Multi-agent orchestration** — specialized AI agents (Agent Zero, Crew AI, OpenClaw) with self-healing monitoring
- **MCP tool support** — 22 agricultural tools exposed via the Model Context Protocol
- **Localization** — multi-language UI with a translation validator and CI hard gate
- **Field/mobile support** — PWA + Capacitor mobile builds, offline-first with CRDT conflict resolution, low-end-device thermal/memory budgets
- **Browser extension** — MV3 extension with sidepanel, offline queue, and content scripts
- **Payments & comms** — Stripe/PayPal billing, SMS/USSD, WhatsApp, email workflows, web push

## Tech stack

- **Backend**: Node.js 18+, Express, TypeScript
- **Database**: PostgreSQL 16 with Prisma ORM (+ pgvector)
- **Cache / queue**: Redis (cache, Socket.IO adapter, BullMQ)
- **AI providers**: OpenAI, Groq, Azure OpenAI, Google Vertex, Anthropic, Ollama
- **Frontend**: React 18, Tailwind CSS, Vite, Zustand, TanStack Query
- **Packaging**: Docker Compose, GitHub Actions CI/CD

## Local development

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Quick start

1. **Start infrastructure** (PostgreSQL + Redis):
   ```bash
   cd ag-extension-dashboard
   docker-compose up -d app-db redis
   ```

2. **Install backend dependencies:**
   ```bash
   cd ag-extension-dashboard/src/backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ag-extension-dashboard/src/frontend
   npm install
   ```

4. **Install the shared contract package:**
   ```bash
   cd ag-extension-shared
   npm install
   ```

5. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

6. **Run the backend** (from `ag-extension-dashboard/src/backend`):
   ```bash
   npm run dev
   ```

7. **Run the frontend** (from `ag-extension-dashboard/src/frontend`):
   ```bash
   npm run dev
   ```

## Environment variables

### Required for development

```bash
# AI provider (choose one)
OPENAI_API_KEY=your-openai-key
# or
GROQ_API_KEY=your-groq-key

# Database & cache (auto-configured by Docker Compose defaults)
DATABASE_URL=postgresql://postgres:postgres@localhost:7501/ag_extension
REDIS_URL=redis://:agext_redis_2024@localhost:7502
```

### Production

```bash
NODE_ENV=production
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
AI_PRIMARY_PROVIDER=groq                    # openai | groq | azure_openai | google_vertex | anthropic
GROQ_API_KEY=your-api-key                   # or the key for your chosen provider
JWT_SECRET=your-very-long-random-secret-key
CORS_ORIGIN=https://your-production-domain.com
CREDENTIAL_ENCRYPTION_KEY=your-encryption-key
```

## API

Health checks:

- `GET /health` / `GET /api/health` — full dependency health (DB, cache, AI provider, agents)
- `GET /health/live` / `GET /health/ready` — liveness / readiness probes

Business routes are mounted under `/api/` (legacy) and `/api/v1/` (i18n-aware). Representative endpoints:

- `POST /api/auth/login` — authentication
- `GET /api/farmers` — farmer management
- `GET /api/fields` — field/crop records
- `POST /api/chatbot/message` — AI chat
- `GET /api/analytics` — analytics and reporting
- `GET /api/knowledge` — RAG knowledge base
- `GET /api/mcp/tools` / `POST /api/mcp/tools/call` — MCP tool execution

See `ag-extension-dashboard/src/backend/src/routes/` for the full route surface.

## MCP tools

The platform exposes 22 specialized agricultural tools, including:

- Weather forecasting with farming advice
- Plant disease diagnosis
- Market price analysis
- Crop yield prediction
- Satellite NDVI analysis
- Agricultural research (RAG)
- Multi-language translation
- Agent task orchestration

## Architecture & security docs

- [Architecture](docs/ag-extension-dashboard-architecture.md)
- [Deployment workflow](docs/DEPLOY_WORKFLOW.md)
- [Production deployment guide](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Cybersecurity checklist](docs/CYBERSECURITY_CHECKLIST.md)
- [Observability](docs/OBSERVABILITY.md)
- [Accessibility](docs/ACCESSIBILITY.md)

## Development commands

Run from the relevant package directory.

| Command | Where | Purpose |
|---|---|---|
| `npm run dev` | backend / frontend | Start dev server |
| `npm run build` | backend / frontend | Type-check + build |
| `npm test` | backend (`jest`) / frontend (`vitest`) | Run unit tests |
| `npm run lint` | backend / frontend | ESLint |
| `npm run security:test` | repo root | Run security test suites across all services |
| `npm run security:audit` | repo root | Secrets scan + dependency audit |

## CI/CD

Deployment is automated via GitHub Actions (`.github/workflows/`): `ci-cd.yml`, `security-audit.yml`, `deploy-stage.yml`, `deploy-all.yml`, and `mobile-release.yml`.

## Contributing

1. Work on the `stage` branch (see `CLAUDE.md`)
2. Make your changes
3. Add tests where applicable
4. Ensure `tsc --noEmit` and lint pass
5. Open a PR
