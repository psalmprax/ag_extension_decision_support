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
- **Multi-agent orchestration** — specialized AI agents (Agent Zero, Crew AI, OpenClaw) with self-healing monitoring; the OpenClaw runtime bridges to a configurable gateway and fails loud (503) when none is configured
- **MCP tool support** — 22 agricultural tools exposed via the Model Context Protocol
- **Localization** — multi-language UI with a translation validator and CI hard gate
- **Field/mobile support** — PWA + Capacitor mobile builds, offline-first with durable mirrored mutation queue and conflict reconciliation, low-end-device thermal/memory budgets
- **Browser extension** — MV3 extension with sidepanel, offline queue, and content scripts
- **Payments & comms** — Stripe billing (checkout + signature-verified webhooks) and PayPal billing (one-time sales granting prepaid passes, plus Subscriptions API auto-renewing profiles with lifecycle webhooks), SMS/USSD, WhatsApp (incl. template messages), email workflows, web push
- **Enterprise Security & Identity Hardening** — RFC 6238 TOTP Authenticator (2FA), brute-force account lockout, SHA-256 session invalidation, and GeoIP login auditing
- **Zero-Connectivity Field Edge** — On-device visual disease classification via HTML5 canvas, WGS-84 geodesic parcel boundary tracing & acreage calculation
- **Voice channels** — transcription and synthesis are available when the relevant providers are configured; IVR broadcast prototypes are not production-enabled by default.
- **Satellite Earth Observation & Sentinel-2 NDVI Indexing** — 10m multispectral NDVI/EVI/NDWI calculation, crop stress anomaly detection, and Sentinel Hub parcel band ingestion (fails loud with an explicit "unconfigured" error when Sentinel Hub credentials are absent)
- **Multi-Tenant Agribusiness Federation** — Organization-Region-Cooperative hierarchical tenancy, custom chemical restrictions, and white-label branding *(demo-scale: two seeded tenants in a registry with fail-closed compliance checks; tenant CRUD/multi-DB tenancy is not implemented yet)*
- **Durable Offline Mutation Queue & Stateful Conflict Reconciliation** — Cryptographic idempotency keys, dual IndexedDB/localStorage persistence, and exponential backoff retry
- **Unified Multi-Cloud Object Storage** — S3-compatible architecture supporting the cheapest raw storage (Backblaze B2 @ $0.006/GB) and zero-egress streaming (Cloudflare R2), with direct presigned uploads, dual local caching, and report archival (see [`docs/MEDIA_OBJECT_STORAGE_GUIDE.md`](./docs/MEDIA_OBJECT_STORAGE_GUIDE.md))

> 📖 **Complete Architecture Documentation**: See [`ARCHITECTURE_PILLARS.md`](./ARCHITECTURE_PILLARS.md) for full data models, algorithmic formulas, and API contracts.
>
> 📜 **Prototype capabilities**: credit, trade, traceability, telemetry, mechanization, pest and tenant pillar routes are specification-phase and return 501 except for the explicitly enabled production routes. Prototype routes can only be enabled in explicitly configured development or test environments, and responses are labeled as prototypes. See [`docs/PILLAR_SERVICES_DECISION.md`](./docs/PILLAR_SERVICES_DECISION.md) and `routes/pillars/index.ts`; do not treat prototype outputs as verified production services.

The public demo and landing-page simulator show scripted examples, not live retrieval, delivery, measurements or field activity. No messages or visits are sent or queued by these previews. Diagnostic suggestions require qualified local confirmation, and provider-dependent features require deployment configuration.

## Advisory quality and country-specific safeguards

Demo farmer IDs (`demo-farmer-*`) identify static frontend fixtures, not live
database records. Reusing those IDs across demo visitors does not identify a
real farmer. Demo field/crop-cycle API mutations are rejected server-side;
live analytics reject demo sessions and exclude seeded demo farmers and their
visits/conversations. The demo dashboard and farmer list both use 12 fixtures.
Live counts depend on authorized database records, not that static dataset.

Knowledge answers, dashboard chat and the landing demo use one advisory policy:
plain-language explanations, explicit uncertainty, country-aware evidence and
locally applicable guidance. The same safeguards apply in every supported country;
the UI's country coverage does **not** imply a complete regulatory dataset.

The landing demo no longer substitutes canned pesticide/lime doses or fabricated
source citations. Open-ended advice with numeric treatment rates or product-specific
harvest/re-entry intervals is withheld pending a current locally registered label
or soil-test-based recommendation. Botanical pesticides are not exempt. Generic
knapsack conversions and universal PHI/REI values are not supplied. Serious pest
mentions require local confirmation, not an automatic worldwide quarantine claim.

Sources tagged `unverified_scrape` and explicit foreign-country sources are excluded
from grounding. Unknown geography/dates remain visibly unestablished. Numbered
citations correspond to the evidence actually supplied to the model; unsupported
references/links are removed. `advisoryQuality` distinguishes retrieved evidence
from general guidance and always reports open-chat regulatory authorization as
`not_established`. Citation integrity is **not** proof that a source supports a claim.
The legacy `verified_sources` API value describes retrieval only; the UI labels it
"Retrieved Sources", not verified advice.

Knowledge answer caches are policy-versioned, user/location/language-scoped, and
expire after one hour (one minute for classified weather/market queries). The personalized pipeline no longer reads or writes shared
semantic answer caches. Audio reads the guarded answer rather than a new LLM summary.

Country names are recognized using localized names for the 24 UI languages, with
the latest explicit user location taking precedence over history and profile hints.
Not every inflected place name is recognized; confirm location before field-specific
decisions. Treatment detection includes Unicode digits and selected word-number
forms, with safety refusals and evidence notices in those languages. This is a
conservative text guard, not a complete multilingual safety classifier.

Advisory tools are restricted to public date/weather evidence. Personal-record,
shared-memory, orchestration, account and treatment-calculator tools are unavailable
in chat. Knowledge's agentic loop requires `KNOWLEDGE_AGENTIC_LOOP=true`. Retrieval,
inference, tool calls and optional audio/assets have bounded caller deadlines; these
do not cancel every underlying provider operation. Unreviewed scraper extracts
cannot bypass quarantine, and a retrieval timestamp is never a publication date.

AIHubMix uses `AIHUBMIX_API_KEY` for text. Speech still requires `OPENAI_API_KEY`
or local Whisper for transcription; server synthesis supports English/Swahili,
with browser synthesis for other languages. Browser speech quality varies. Long
speech inputs fail explicitly instead of silently dropping the end of an advisory.

Before claiming expert-level accuracy, agronomists should review representative
cases for **each** country and language: pest look-alikes, planting under local
rainfall/frost conditions, missing locations, contradictory sources, soil amendment
requests and current local registrations. Require zero unverified treatment doses
or fabricated citations in those cases, and assess factual support, practical
usefulness and translation separately. Automated regression tests cover policy
boundaries; they do not constitute field validation or certification.

Full knowledge sync returns an error on a failed write and uses a PostgreSQL
session advisory lock to reject concurrent runs across backend instances sharing
the same database. It requires a direct or session-pooled PostgreSQL connection,
not transaction pooling. If the lock connection is lost, the run fails at its
next checkpoint; an already-running operation cannot be cancelled by that check.
Status reports database-wide activity, while `lastSyncAt` is process-local.

New FAOSTAT syncs use stable IDs per country and source; this does not remove
older duplicates created by earlier versions. FAOSTAT results are excluded from
advisory grounding until mappings, coverage and observations have been independently
verified. Live responses are checked for matching country, item, element codes and
units, but this is not independent validation. Unverified static fallback data is
disabled by default and cannot be enabled outside development/test. Existing
articles are retained and withheld from grounding, not automatically deleted.
The same advisory quarantine covers live FAOSTAT production anomalies and
FAOSTAT-derived price snapshots, including the current GIEWS adapter, while
preserving separately sourced price snapshots. The advisory cache namespace was
changed so answers produced before quarantine are not reused.
The [provider's published API examples](https://github.com/FAOSTAT/faostat-api/blob/master/faostat-api-web/src/main/resources/payloads/GetData_OUT.json)
describe a different response shape from this adapter; unsupported shapes fail
explicitly until the current live endpoint can be verified.

The sandbox mechanization registry scopes searches and registrations to the active
user's database-backed organization. Existing records without a tenant are not
visible; operators must verify ownership before assigning them. This isolation does
not make the wider prototype pillars or their estimates production-ready.

RAG v2 only retrieves chunks and graph links whose source-content hash matches the
current article. Article searches fall back to the full article when current chunks
are unavailable. After deploying the derived-data migration, an authorized knowledge
manager should run `/api/v1/knowledge/ragv2/bootstrap` to rebuild chunks and graph
links; older unversioned derived records remain stored but are excluded from retrieval.
Graph links indicate only co-occurrence and are not verified agronomic relationships
or recommendations. Rebuilding can require substantial embedding-provider capacity.

Run the focused regression suites:

```bash
npm test --workspace ag-extension-backend -- --runInBand src/__tests__/advisoryPolicy.test.ts src/__tests__/advisoryRuntime.test.ts src/__tests__/askPipeline.advisoryPolicy.test.ts src/__tests__/security.agronomicSafetyGuard.test.ts src/__tests__/publicDemo.test.ts src/__tests__/chatbot.completionsOwnership.test.ts
```

## Tech stack

- **Backend**: Node.js 18+, Express, TypeScript
- **Database**: PostgreSQL 16 with Prisma ORM (+ pgvector)
- **Object Storage**: S3-Compatible (Backblaze B2, Cloudflare R2, Wasabi, Hetzner, MinIO, Local Disk)
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
- [CI/CD Q&A playlist](docs/CICD_QA_PLAYLIST.md)
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
