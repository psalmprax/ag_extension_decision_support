# Contributing to AG-Extension

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Branch Strategy](#branch-strategy)
- [Release Process](#release-process)
- [CI/CD Pipeline](#cicd-pipeline)
- [Pull Request Guidelines](#pull-request-guidelines)

---

## Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Git

### 1. Clone and install

```bash
git clone https://github.com/psalmprax/ag_extension_decision_support.git
cd ag_extension_decision_support/ag-extension-dashboard
```

### 2. Start infrastructure (Postgres + Redis)

```bash
docker compose up -d app-db redis
```

### 3. Backend setup

```bash
cd src/backend
cp .env.example .env   # add API keys
npm install
npx prisma generate
npx prisma migrate dev
npm run dev             # starts on :3001
```

### 4. Frontend setup

```bash
cd src/frontend
npm install
npm run dev             # starts on :5173
```

### 5. Verify

- Backend health: `curl http://localhost:3001/api/health`
- Frontend: open `http://localhost:5173`

### Docker Compose profiles

| Profile | Services | Command |
|---|---|---|
| default | backend + frontend + traefik | `docker compose up -d` |
| `infra` | app-db + redis only | `COMPOSE_PROFILES=infra docker compose up -d` |
| `ai` | + ollama (local LLM) | `COMPOSE_PROFILES=ai docker compose up -d` |

Full local deployment (with agents):

```bash
docker compose -f docker-compose.yml -f docker-compose.agents.yml up -d --build
```

---

## Project Structure

```
ag-extension-decision-support/
├── .github/workflows/       # CI/CD pipeline
├── ag-extension-dashboard/
│   ├── docker-compose.yml   # Base compose (dev)
│   ├── docker-compose.prod.yml
│   ├── docker-compose.agents.yml
│   ├── docker-bake.hcl      # Build targets for parallel Docker builds
│   ├── src/
│   │   ├── backend/         # Express + TypeScript API
│   │   │   ├── prisma/      # Schema + migrations
│   │   │   └── src/         # Routes, services, middleware
│   │   ├── frontend/        # React + Vite + Tailwind
│   │   └── agents/          # Python AI agents (Agent Zero, CrewAI)
│   └── scripts/             # Deploy, migration, utility scripts
├── docs/                    # Architecture, deployment, workflow docs
├── release.sh               # Release script (stage → master)
├── check-docker-disk.sh     # Disk usage health check
└── CONTRIBUTING.md          # This file
```

---

## Code Quality

### Linting

Run from the project root:

```bash
npm run lint                # both frontend + backend
npm run lint:frontend       # frontend only
npm run lint:backend        # backend only
```

### Formatting (frontend)

```bash
cd src/frontend
npm run format              # auto-format with Prettier
npm run format:check        # check only
```

### TypeScript checks

```bash
cd src/frontend
npm run typecheck           # tsc --noEmit
```

### Pre-commit hooks

Both backend and frontend use **husky** + **lint-staged** — linting runs automatically on staged files before every commit. If linting fails, the commit is blocked.

---

## Testing

### Backend (Jest)

```bash
cd src/backend
npm test                    # run tests
npm run test:coverage       # with coverage report
```

### Frontend (Vitest)

```bash
cd src/frontend
npm test                    # run tests
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report
```

### E2E (Playwright)

```bash
npm run test:e2e            # from project root
```

Tests run automatically in CI on every push and PR (see [CI/CD Pipeline](#cicd-pipeline)).

---

## Branch Strategy

| Branch | Auto-deploys to | Usage |
|---|---|---|
| `master` | **Production** | Stable, reviewed code only. Protected — no direct pushes. |
| `stage` | **Testing server** | Active development. Push here to trigger CI + testing deploy. |
| `feature/*` | **Testing server** | Short-lived feature branches. Created from and merged back to `stage`. |

### Workflow

```
feature/foo ──┐
              ▼
stage ────────●─────────────────●─────── (testing auto-deploy)
              \               /
master ───────●───────────────●────────── (production deploy on merge)
```

1. Create a feature branch from `stage`: `git checkout stage && git checkout -b feature/my-change`
2. Commit and push: `git push origin feature/my-change`
3. Open a PR into `stage` for review
4. Merge → testing server auto-deploys
5. When ready for production, use `./release.sh` to merge `stage` into `master`

---

## Release Process

Releases are managed via `release.sh` at the project root. It automates the **stage → master merge**, **push**, and **tagging**.

### Usage

```bash
./release.sh                      # interactive (prompts for tag)
./release.sh v1.2.3               # with explicit tag
./release.sh v1.2.3 --dry-run     # preview without making changes
./release.sh v1.2.3 --force       # skip dirty-repo checks
```

### What it does

| Step | Action |
|---|---|
| 0 | Pre-flight: checks branch, dirty files, ahead-of-remote |
| 1 | `git pull --rebase origin stage` |
| 2 | `git checkout master` |
| 3 | `git pull --rebase origin master` |
| 4 | `git merge stage --no-ff` (creates visible merge commit) |
| 5 | `git push origin master` |
| 6 | `git tag -a vX.Y.Z` + `git push origin vX.Y.Z` |
| 7 | `git checkout stage` (back to dev branch) |
| 8 | Pop stash if any was created |

After pushing `master`, the production deploy triggers automatically via GitHub Actions.

### Tag naming

Tags follow `vYYYYMMDD-SHORTNAME` by default (e.g. `v20250407-fix-auth`). Override with `./release.sh v1.2.3`.

---

## CI/CD Pipeline

See [docs/DEPLOY_WORKFLOW.md](docs/DEPLOY_WORKFLOW.md) for full details.

### High-level flow

```
Push to stage/feature/*  ──▶  CI checks  ──▶  Deploy to TESTING server
PR merged to master       ──▶  CI checks  ──▶  Deploy to PRODUCTION server
Manual trigger            ──▶  CI checks  ──▶  Deploy to PRODUCTION
```

### CI checks (gate)

Every trigger passes through:

- **Frontend**: `npm ci` → `npm run lint` → `npm run build` → `npm run test:coverage`
- **Backend**: `npm ci` → `prisma generate` → `npm run lint` → `npm run build` → `npm test`

If CI fails, **deployment is skipped**.

### Build caching

Docker images are built in parallel via `docker buildx bake` with **GHCR remote cache**. Cached layers survive server rebuilds and disk pruning.

### Disk cleanup

Every deploy reports disk usage before/after and prunes images/build cache older than 24 hours.

---

## Pull Request Guidelines

1. **Keep PRs focused** — one feature or fix per PR
2. **Write descriptive titles** — e.g. `feat: add soil moisture sensor integration`
3. **Reference issues** — use `Closes #123` or `Related to #456`
4. **Update docs** — if adding/changing functionality, update relevant docs in `docs/`
5. **Add tests** — new features should include tests; bug fixes should include a regression test
6. **Ensure CI passes** — all lint, build, and test checks must be green before merge
7. **Target `stage`** — feature branches merge into `stage`, not `master`

### PR template

```markdown
## What
Brief summary of the change.

## Why
Why this change is needed.

## Testing
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] Linting passes
- [ ] Manual smoke test on testing server

## Docs updated
- [ ] README
- [ ] docs/
```

---

## Environment Variables

### Required for development

```bash
# AI Provider (choose one)
OPENAI_API_KEY=sk-...
# or
GROQ_API_KEY=gsk_...

# Database (auto-configured with Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:7501/ag_extension
REDIS_URL=redis://localhost:7502
```

### Required for production

See [docs/DEPLOY_WORKFLOW.md](docs/DEPLOY_WORKFLOW.md#required-github-secrets) for the full secret list.

---

## Getting Help

- **CI/CD issues**: See [docs/DEPLOY_WORKFLOW.md](docs/DEPLOY_WORKFLOW.md#troubleshooting)
- **Deployment issues**: See [ag-extension-dashboard/DEPLOYMENT.md](ag-extension-dashboard/DEPLOYMENT.md)
- **Architecture**: See [docs/ag-extension-dashboard-architecture.md](docs/ag-extension-dashboard-architecture.md)
