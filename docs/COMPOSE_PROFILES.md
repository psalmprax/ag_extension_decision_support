# Compose Profiles & Service Boundaries

> Source-of-truth for which Docker Compose services start by default, which are
> opt-in, and exactly how to opt them in. Companion to
> [docs/dashboard/AI_AGENT_INTEGRATION.md](dashboard/AI_AGENT_INTEGRATION.md).

---

## TL;DR

| Layer | Mechanism | Services |
|---|---|---|
| **Always-on** | No `profiles:` line; declared in the base `docker-compose.yml` | `app-db`, `redis`, `traefik`, `backend`, `frontend` |
| **Profile-gated** | `profiles: ["ai"]` on the service block in `docker-compose.yml` (line 171 of ~190) | `ettametta-ollama` |
| **Modular override** | Lives in a separate file: `docker-compose.agents.yml`. Only contributes when you `-f` it in. | `agent-zero`, `crew-ai` |
| **Environment overlay** | `docker-compose.{dev,staging,prod}.yml` — never add services, only override fields on `traefik`/`backend`/`frontend` | (none — these *modify* the always-on set) |

The boundary has **exactly two opt-in levers** — both verified:

1. `COMPOSE_PROFILES=ai` (or `--profile ai`) → brings in `ettametta-ollama`
2. Append `-f docker-compose.agents.yml` → brings in `agent-zero` and `crew-ai`

**Verification commands** (re-run after any compose change):

```bash
# Should return exactly one hit
grep -rn 'profiles:' --include='*.yml' --include='*.yaml' . \
  | grep -v node_modules | grep -v .git

# Should return empty — no extends/include anywhere
grep -rnE '^(include|extends):' --include='*.yml' . \
  | grep -v node_modules | grep -v .git
```

If you do neither (no profile, no `-f agents.yml`), both `ettametta-ollama`
and the agent services stay down silently. The
`deploy-stage.yml`-side commit-message hint
`Pin OLLAMA_HOST + fallback so backend doesn't DNS-timeout on ettametta-ollama`
documents this exact failure pattern in CI history.

---

## Always-on services

These start on every `docker compose … up` invocation against this repo,
with no flags.

| Service | Purpose | Defined at |
|---|---|---|
| `app-db`   | PostgreSQL 16+ with `pgvector`, healthchecked via `pg_isready` | `docker-compose.yml` |
| `redis`    | Cache + BullMQ broker, healthchecked via `redis-cli ping`     | `docker-compose.yml` |
| `traefik`  | Reverse proxy; HTTP-only on `:80` by default                   | `docker-compose.yml` (overridden by `staging`/`prod` for HTTPS + ACME) |
| `backend`  | Express/TypeScript API (port 3001 inside container)           | `docker-compose.yml` |
| `frontend` | Vite dev server in dev; Nginx-served SPA in staging/prod      | `docker-compose.yml` |

`backend`'s `depends_on` is `app-db` (healthy) + `redis` (healthy).
`frontend`'s `depends_on` is `backend`. This chain is honored unless a
workflow passes `--no-deps` (don't).

---

## Profile-gated services

### `ettametta-ollama` — profile `ai`

```yaml
# docker-compose.yml — block starts line 168 (`ettametta-ollama:`)
ettametta-ollama:
  image: ollama/ollama:0.6.2
  container_name: ettametta-ollama
  profiles:
    - ai
  …
  entrypoint: /bin/sh -c "ollama serve & sleep 10 && ollama pull llama3.2:3b && wait"
```

**What it is for:** Local Ollama serving `llama3.2:3b` (auto-pulled on first
boot, persisted via the `ollama_data` named volume). The backend reads
`OLLAMA_HOST=${OLLAMA_HOST:-http://ettametta-ollama:11434}` — this resolves
to the local Ollama container when the `ai` profile is active.

> **Cascade mechanics — note:** in `aiProvider.ts:getWithFallback()`,
> `primaryProvider` and `fallbackProvider` are the **first two entries** of
> the same candidate list
> (`[primary, fallback, openai, anthropic, groq, ollama]`); there is no
> separate primary-then-fallback lane. Ollama only fires when every earlier
> entry is unconfigured or unhealthy.

**How to opt in:**

```bash
# Option A — env var
COMPOSE_PROFILES=ai docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Option B — flag
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile ai up -d
```

**Failure mode if you forget** (verified against
`src/backend/src/services/aiProvider/aiProvider.ts`):

`AIProviderFactory.getWithFallback()` iterates through
`[primary, fallback, openai, anthropic, groq, ollama]`. For each provider it
calls `isConfigured()` then `healthCheck()`.`OllamaProvider.healthCheck()` issues
`axios.get(${OLLAMA_HOST}/api/tags, { timeout: 2000 })` and returns
`false` on any error. So:

- If any earlier entry in the candidate list is healthy → Ollama is never
  consulted → no symptom even though the service is down.
- If **every** provider including Ollama is unhealthy → the cascade loop
  exits and `throw new Error('All AI providers failed — no provider is
  configured or healthy')` fires directly. The user-visible HTTP code
  depends on the route handler; default Express behaviour is **500
  Internal Server Error** unless the route explicitly maps the throw to
  another status.

> **Crew-AI note:** `crew-ai` (the Python process — see next section) does
> **not** read `OLLAMA_HOST`. Its env block only takes `OPENAI_API_KEY` and
> `ANTHROPIC_API_KEY`. So crewai is unaffected by this gate — only the
> backend's AI fallback is. Do not "install Ollama to fix crewai"; install
> Ollama + enable the `ai` profile so `AI_FALLBACK_PROVIDER=ollama` works.

---

## Modular override services

These are **defined in a separate file** (`docker-compose.agents.yml`) so they
can be added or removed from any environment without touching the always-on
stack. They are *de facto* opt-in: `-f` flag or they don't exist as far as
`docker compose` is concerned.

### `agent-zero`

```yaml
# docker-compose.agents.yml — block starts line 6 (`agent-zero:`)
agent-zero:
  build: { context: ./src/agents, dockerfile: Dockerfile.agent-zero }
  container_name: ag-agent-zero
  ports: ["127.0.0.1:7504:8000"]
  environment:
    - OPENAI_API_KEY=…
    - ANTHROPIC_API_KEY=…
    - DATABASE_URL=…
    - REDIS_URL=…
  depends_on: [app-db, redis]
```

### `crew-ai`

```yaml
# docker-compose.agents.yml — block starts line 35 (`crew-ai:`)
crew-ai:
  build: { context: ./src/agents, dockerfile: Dockerfile.crew-ai }
  container_name: ag-crew-ai
  ports: ["127.0.0.1:7505:8001"]
  environment:
    - OPENAI_API_KEY=…
    - ANTHROPIC_API_KEY=…
    - DATABASE_URL=…
    - REDIS_URL=…
  depends_on: [app-db, redis]
```

**How to opt in:**

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.agents.yml \
  up -d --build
```

**Dependencies:** Both depend on `app-db` + `redis` (always-on). Neither
depends on `ettametta-ollama` — they use Anthropic/OpenAI APIs directly.
Adding the agents file will *not* start `ettametta-ollama` for you.

**Build vs runtime note:** The `agent-zero` and `crew-ai` *images* are
produced by `docker buildx bake` reading
`ag-extension-dashboard/docker-bake.hcl` (CI step 3/5 of
`.github/workflows/deploy-all.yml`). That bake runs regardless of whether
`-f docker-compose.agents.yml` is later appended. So **the image can be
present locally even when the runtime service is opted out** — image
build and runtime startup are independent opt-in paths. Image existence does
not imply the service is running.

---

## Environment overlays

These never introduce a new service; they only override fields on the
always-on `traefik`, `backend`, `frontend`:

| File | What it does |
|---|---|
| `docker-compose.dev.yml` | Hot-reload bind mounts + debug ports 9229/9228 + Traefik `DEBUG` log level. **Does not** remove the agents override or opt in anything. |
| `docker-compose.staging.yml` | Traefik gets `:443` + Let's Encrypt resolver; backend `NODE_ENV=staging`; frontend rebuilds for Nginx SPA hosting. |
| `docker-compose.prod.yml` | Traefik gets `:443` + ACME; backend `NODE_ENV=production`; frontend Nginx target. |

Each one is a partial — it relies on the always-on services in
`docker-compose.yml` for `app-db`, `redis`, etc.

---

## Deployment recipes

| Scenario | Compose command |
|---|---|
| Pure dev (no Ollama, no agents) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| Dev with local Ollama fallback | `COMPOSE_PROFILES=ai docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| Dev with agents (OpenHands exploration) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.agents.yml up -d` |
| Dev with everything | `COMPOSE_PROFILES=ai docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.agents.yml up -d` |
| Staging deploy | `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build <services>` (see CI workflow) |
| Production deploy | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build <services>` (see CI workflow) |

> **Dev port caveat:** `docker-compose.dev.yml` binds Traefik to host port
> `:80` on **all interfaces** (not `127.0.0.1:80`). Pure-dev recipe needs
> either root or a free port 80 on the host. If you can't reserve `:80`,
> drop in a personal override that re-binds via `127.0.0.1:8080:80` or
> similar.

> **Current FYI:** the `deploy-stage.yml` and `deploy-all.yml` GitHub
> Actions workflows do not pass `COMPOSE_PROFILES=ai` and do not append
> `-f docker-compose.agents.yml` (deploy-stage never does; deploy-all does
> append the agents file but still skips the `ai` profile). So in CI:
>
> - `ollama` is never started → backend's `AI_FALLBACK_PROVIDER=ollama`
>   cannot work in staging or production until that workflow is updated.
> - `crew-ai` / `agent-zero` are only present in `deploy-all`, never in
>   `deploy-stage`.

---

## Drift / cleanup opportunities

Found while writing this doc. None of them are blockers.

1. **Stale header comment in `docker-compose.yml` (lines 1–11).** *Cosmetic
   only — does not break compose behavior.* The header's "Profiles
   (optional)" block lists `COMPOSE_PROFILES=full`, `=db`, and `=infra`.
   **None of these profiles actually exist in the file** (only `ai` at line
   171). Suggest removing the three non-existent ones from the header so a
   new operator doesn't burn an hour trying `COMPOSE_PROFILES=infra` and
   debugging why nothing changed.
2. **No smoke-test for the `ai` profile.** `.github/workflows/deploy-{stage,all}.yml`
   do not gate on a working `curl http://ettametta-ollama:11434/api/tags`
   before continuing. Adding `scripts/smoke-ollama.sh` with a PASS/FAIL
   exit + a pre-deploy guard would catch the "profile off → DNS NXDOMAIN →
   silent cascade skip" pattern this entire issue is about.
3. **`AI_FALLBACK_PROVIDER=ollama` is the silent culprit.** If you have no
   `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` set in CI and you've not started
   Ollama, every backend call will fall through and (per
   `aiProvider.ts:getWithFallback()`) eventually throw
   `All AI providers failed — no provider is configured or healthy`. Either
   set `AI_FALLBACK_PROVIDER=` empty in the CI env, or always enable the
   `ai` profile in CI.

---

## Cross-links

- [docs/dashboard/AI_AGENT_INTEGRATION.md](dashboard/AI_AGENT_INTEGRATION.md) — full agent architecture (OpenClaw / Agent Zero / Crew AI / Goose)
- [docs/PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) — production deploy walkthrough
- [docs/DEPLOY_WORKFLOW.md](DEPLOY_WORKFLOW.md) — CI workflow expectations
- [docs/dashboard/PRODUCTION_FLOW.md](dashboard/PRODUCTION_FLOW.md) — runtime topology

> **Stale-docs caveat:** these files were written before the modular
> `docker-compose.agents.yml` flag and the `profiles: ["ai"]` opt-in on
> `ettametta-ollama` were added (mtimes in this repo confirm the compose
> files are newer than some of the docs, but not all four). They may
> describe services as always-on or list service-start commands that no
> longer match the current compose flags. Treat them as architectural
> intent; verify their claims against this doc before quoting in CI
> run-books, READMEs, or onboarding material.

---

_Last reconciled_ against the compose files on `origin/stage` commit
`425af4e4` (latest at time of writing). To re-verify nothing has drifted:

```bash
grep -rn 'profiles:' --include='*.yml' --include='*.yaml' . \
  | grep -v node_modules | grep -v .git   # expect 1 hit (compose.yml:171)
grep -rnE '^(include|extends):' --include='*.yml' . \
  | grep -v node_modules | grep -v .git    # expect no hits
```
