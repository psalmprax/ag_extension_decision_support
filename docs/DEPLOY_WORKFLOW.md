# deploy-all.yml — CI/CD Workflow Reference

**File:** `.github/workflows/deploy-all.yml`

Automated CI/CD pipeline for the AG-Extension Decision Support platform.

---

## Trigger Matrix

| Trigger | Branches | What happens |
|---|---|---|
| `push` | `stage`, `feature/*` | CI checks + deploy to **Testing** server |
| `pull_request` (merged) | → `master` | CI checks + deploy to **Production** server |
| `workflow_dispatch` | any | Manual trigger — deploy to **Production** (with optional `force_clean_rebuild` toggle; only applies to Production — testing job doesn't support manual triggers) |

---

## Jobs

### 1. `ci-checks` — Gate (all triggers)

Runs on the GitHub runner. Every trigger passes through this job first:

| Step | What |
|---|---|
| Checkout | `actions/checkout@v4` |
| Node.js setup | Node 20 with npm cache |
| Frontend | `npm ci` → `npm run lint` → `npm run build` → `npm run test:coverage` |
| Backend | `npm ci` → `prisma generate` → `npm run lint` → `npm run build` → `npm test -- --forceExit` |

**If CI fails, deployment is skipped** (both jobs have `needs: ci-checks`).

---

### 2. `deploy-testing` — Testing Server

**Trigger:** `push` to `stage` or `feature/*`

All steps run via `appleboy/ssh-action` on `${{ secrets.TEST_SERVER_IP }}`.

| Step | Timeout | What it does |
|---|---|---|
| **1/4 Sync** | 3 min | Clone (if missing) → fetch → checkout target branch → `git reset --hard` → create `.env` from `.env.example` |
| **2/4 Infra** | 20 min | Start DB/Redis if down → run Prisma migrations (with 30-retry loop, P3005 baselining) |
| **3/4 Build** | 60 min | Build all 4 Docker images (see below) → `docker compose up -d --force-recreate --no-build` |
| **4/4 Cleanup** | 5 min | Report disk usage → prune images + build cache |

**Compose files used:** `-f docker-compose.yml -f docker-compose.agents.yml`

---

### 3. `deploy-production` — Production Server

**Trigger:** PR merged to `master`, or manual `workflow_dispatch`

Same 4-step structure as testing, with two differences:

| Difference | Testing | Production |
|---|---|---|
| **Compose files** | `docker-compose.yml` + `docker-compose.agents.yml` | `docker-compose.yml` + `docker-compose.prod.yml` + `docker-compose.agents.yml` |
| **Env setup** | Copies `.env.example` | Creates `.env` from **GitHub Secrets** (`JWT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ACME_EMAIL`) |
| **Branch** | Checks out the pushed branch (`stage` or `feature/*`) | Checks out `master` |

---

## Build Step (3/4) in Detail

All 4 services are built in parallel via `docker buildx bake`:

| Service | Dockerfile | Image tag |
|---|---|---|
| `backend` | `src/backend/Dockerfile` | `ag-extension-dashboard_backend:latest` |
| `frontend` | `src/frontend/Dockerfile` | `ag-extension-dashboard_frontend:latest` |
| `agent-zero` | `src/agents/Dockerfile.agent-zero` | `ag-extension-dashboard_agent-zero:latest` |
| `crew-ai` | `src/agents/Dockerfile.crew-ai` | `ag-extension-dashboard_crew-ai:latest` |

### Normal build (cached)

```bash
docker buildx create --use --driver docker-container --name remote-builder
docker buildx bake \
  -f docker-bake.hcl \
  --set "*.cache-from=type=registry,ref=ghcr.io/REPO/buildcache:SERVICE" \
  --set "*.cache-to=type=registry,ref=ghcr.io/REPO/buildcache:SERVICE,mode=max" \
  backend frontend agent-zero crew-ai
```

- Pulls cached layers from GHCR (`type=registry`)
- Exports fresh cache after build (`mode=max` saves all layers)
- Permission: `GITHUB_TOKEN` needs `packages: write` (set at workflow level)

### Clean rebuild (`force_clean_rebuild=true`)

```bash
docker buildx bake -f docker-bake.hcl backend frontend agent-zero crew-ai
```

- No cache pulled, no cache exported
- Useful when cache is stale or corrupted

### Cache storage

Layers stored at `ghcr.io/OWNER/REPO/buildcache:SERVICE` — one cache tag per service. Survives server rebuilds and `docker system prune`.

---

## Cleanup Step (4/4) Details

Runs after every deploy (both servers):

```bash
docker image prune -a -f --filter "until=24h"    # Remove unused images older than 1 day
docker builder prune -f --filter "until=24h"      # Remove build cache older than 1 day
```

Before/after disk usage is logged to the workflow output for trend tracking.

---

## Disk Health Script

**File:** `check-docker-disk.sh` — standalone health check for manual inspection.

```bash
# Local
./check-docker-disk.sh

# Over SSH
ssh root@server 'bash -s' < check-docker-disk.sh --prune
```

Reports: filesystem usage → Docker system df → top 10 images → dangling counts → optional cleanup.

---

## Required GitHub Secrets

| Secret | Used by | Purpose |
|---|---|---|
| `TEST_SERVER_IP` | deploy-testing | Testing server host |
| `PROD_SERVER_IP` | deploy-production | Production server host |
| `SSH_PRIVATE_KEY_TESTING` | deploy-testing | SSH key for testing server |
| `SSH_PRIVATE_KEY_PRODUCTION` | deploy-production | SSH key for production server |
| `JWT_SECRET` | deploy-production | Injected into production `.env` |
| `OPENAI_API_KEY` | deploy-production | Injected into production `.env` |
| `ANTHROPIC_API_KEY` | deploy-production | Injected into production `.env` |
| `ACME_EMAIL` | deploy-production | Let's Encrypt cert notifications |

Auto-generated `GITHUB_TOKEN` must have `packages: write` scope (set in workflow) for GHCR cache auth.

---

## Release Process

**File:** `release.sh` — automates `stage → master` merge + tag + push.

```bash
./release.sh                      # interactive (prompted for tag)
./release.sh v1.2.3               # with tag
./release.sh --dry-run            # preview without changes
```

After release, the production deploy triggers automatically (PR merge event).

---

## Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Deploy skipped | CI checks failed | Workflow → ci-checks job logs |
| Build step hangs/timeout | Large image rebuild + no cache | Use `force_clean_rebuild=true` or check server disk space |
| `docker: command not found` on server | Docker not installed | SSH in and run `docker version` |
| Migration retry loop | DB not ready or connection string wrong | Check `.env` on server |
| GHCR cache not working | Token lacks `packages: write` | Verify workflow `permissions:` block |
| `--no-build` fails | Image tag mismatch with compose project name | Run `docker images | grep ag-extension` on server to verify tags |
