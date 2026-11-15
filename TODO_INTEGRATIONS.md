# Integration TODO List

> Actionable tasks derived from the plugin/repo relevance analysis (2026-07-06).
> Prioritized by impact on the Ag-Extension Decision Support Dashboard.

---

## 🟢 Priority 1 — High-Impact Integrations

### 1. `ZhuLinsen/daily_stock_analysis` → Agricultural Report Automation
- [x] Clone and study the repo architecture (data fetching → LLM analysis → report generation → push notifications)
- [x] Map stock data sources to agricultural equivalents:
  - [x] AkShare/YFinance → Weather APIs, NDVI satellite feeds, soil sensor data
  - [x] Stock indicators (MACD, RSI) → Agricultural metrics (NDVI trends, soil moisture, growing degree-days)
  - [x] Market data → Crop commodity prices (already in our market intelligence module)
- [x] Adapt the LLM-driven report template for daily farmer advisory briefings
- [x] Integrate multi-channel push notifications (Telegram, SMS, email) for farmer outreach
- [x] Set up GitHub Actions (or cron) for scheduled daily/weekly analysis runs
- [x] Connect to existing MCP tools (weather forecasting, crop yield prediction, market price analysis)

### 2. `koala73/worldmonitor` → Dashboard Architecture Patterns
- [x] Study the real-time multi-source data aggregation architecture
- [x] Review their MCP server implementation (39 tools) and compare with our 21+ tools
- [x] Evaluate the variant system for creating regional agricultural dashboards (by crop, climate zone, market)
- [x] Borrow UI patterns for data layer toggles (weather overlay, disease hotspots, market heatmaps)
- [x] Assess their React/Vite/TypeScript component patterns for reuse
- [x] Review supply-chain/logistics monitoring for agricultural commodity tracking adaptation

### 3. `Panniantong/Agent-Reach` → Real-Time Agricultural Intelligence
- [x] Clone and evaluate platform coverage (Twitter, Reddit, YouTube, etc.)
- [x] Prototype a social media monitoring pipeline for:
  - [x] Emerging pest/disease reports from farmer communities
  - [x] Agricultural policy/regulation changes
  - [x] Market sentiment and crop price discussions
  - [x] Weather event impact reports from affected regions
- [x] Integrate with multi-agent orchestration system as a data source agent
- [x] Set up automated alerts when agricultural keywords trend across platforms
- [x] Evaluate data quality and reliability for decision support use

---

## 🟢 Priority 2 — Medium-Impact Integrations

### 4. `calesthio/OpenMontage` → Farmer Education Content
- [x] Evaluate video generation pipelines relevant to agriculture (explainers, tutorials)
- [x] Prototype automated generation of:
  - [x] Disease identification video guides
  - [x] Seasonal farming best practices
  - [x] Market trend summaries (video format)
- [x] Assess text-to-speech support for local languages
- [x] Determine infrastructure requirements (FFmpeg, Remotion, GPU needs)
- [x] Estimate cost for cloud API vs local/free alternatives

### 5. `nexu-io/open-design` → Rapid Dashboard Prototyping
- [x] Install and test the AI design workspace locally
- [x] Prototype new dashboard views for:
  - [x] Farmer-facing mobile summaries
  - [x] Extension officer visit planning screens
  - [x] PDF report templates for offline distribution
- [x] Evaluate integration with existing design system (Tailwind CSS tokens)

---

## 🟡 Priority 3 — Development Tooling

> These improve code quality and dev velocity but don't add agricultural features.

### 6. Dev Workflow Plugins
- [x] Install `andrej-karpathy-skills` (drop CLAUDE.md in project root — zero config)
- [x] Evaluate `superpowers` plugin for structured dev methodology (TDD, spec review)
- [x] Evaluate `everything-claude-code` for agent orchestration during development
- [x] Review `ruflo` multi-agent orchestration patterns — any transferable patterns for ag agents?
- [x] Assess `obsidian-skills` — only if using Obsidian for project knowledge management

---

## 🔴 Deprioritized — Low Relevance

### 7. Skipped
- [ ] ~~`penpot/penpot`~~ — Different tech stack (Clojure), no ag-specific features
- [ ] ~~`OpenCut-app/OpenCut`~~ — General video editor, no domain value

---

## Progress Tracking

| Integration | Status | Owner | Target Date | Notes |
|---|---|---|---|---|
| daily_stock_analysis adaptation | ✅ Completed | ag-extension-dashboard | 2026-07-06 | Highest priority |
| worldmonitor patterns | ✅ Completed | ag-extension-dashboard | 2026-07-06 | Architecture study & UI toggles |
| Agent-Reach integration | ✅ Completed | ag-extension-dashboard | 2026-07-06 | Social monitoring & orchestration |
| OpenMontage evaluation | ✅ Completed | ag-extension-dashboard | 2026-07-06 | Content generation eval |
| Open Design prototyping | ✅ Completed | ag-extension-dashboard | 2026-07-06 | UI/UX iteration |
| Dev tooling plugins | ✅ Completed | ag-extension-dashboard | 2026-07-06 | Dev velocity improved |

---

## 🔴 Dependency & Deployment Risk Register (2026-11-15 audit)

Items that need staged work against live services and therefore were NOT
changed blindly. Each entry lists the risk and the concrete remediation.

### Supply chain
- [ ] **`xlsx` resolves to `https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz`** —
  integrity is fine (both lockfiles pin its sha512, so `npm ci` rejects a
  tampered tarball; an earlier note here wrongly said otherwise). The risk is
  availability: if the CDN is down or the URL disappears, every CI, Docker and
  local install fails. Fix in one command from a machine that can reach the
  CDN: `./scripts/vendor-xlsx.sh` — downloads, verifies against the pinned
  sha512, vendors into `ag-extension-dashboard/src/backend/vendor/`, repoints
  the dependency, regenerates both lockfiles and adds the `vendor/` COPY to the
  three Dockerfile stages that install. Then commit. Do NOT swap to the npm
  registry's `xlsx` (0.18.5, unmaintained, with CVEs fixed only in 0.20.x).
- [x] **`@anthropic-ai/sdk`** — upgraded ^0.6.2 → ^1.8.0 (2026-11-15). The provider already
  targeted the Messages API, which 0.6.x never shipped, so the pinned SDK could
  never have worked at runtime. Default model is now config-driven
  (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`; the old hardcoded
  `claude-3-5-sonnet-20241022` was retired Oct 2025). Still needs a live-key smoke test.
- [x] **`@google/generative-ai`** — migrated to `@google/genai` ^3.3.0 (2026-11-15). Embedding
  model moved from retired `embedding-001` to `gemini-embedding-001`, pinned to
  `outputDimensionality: EMBEDDING_DIMENSIONS` (768) so it fits the pgvector
  columns. Auth fixed: a real `GOOGLE_VERTEX_PROJECT_ID` now uses Vertex AI +
  ADC (it was previously passed to the SDK as an API key); API keys go in
  `GEMINI_API_KEY` (a legacy `AIza…` key in the project-ID var still works,
  with a warning). Still needs a live-key smoke test.
- [x] **`@azure/openai`** — removed (2026-11-15); the provider now uses the official `openai`
  SDK's `AzureOpenAI` client (`AZURE_OPENAI_API_VERSION`, default 2024-10-21).
  Requests route per call by deployment name; embeddings use
  `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` with `dimensions` pinned to 768.
  Still needs a live-key smoke test.
- [x] **`paypal-rest-sdk`** — removed (2026-11-15). Its only two calls (classic
  sale create/execute) now go over REST using the service's existing OAuth
  helper — same v1 endpoints, request bodies and payment/sale ids, so the
  webhook and idempotency logic are unchanged. Execution now also requires
  `state === "approved"` (a 2xx with `state: "failed"` used to count as paid).
  Still needs one sandbox purchase end to end.
- [ ] **PayPal v1 Payments API** — itself deprecated by PayPal in favour of v2
  Orders. Migrating changes ids and webhook events (`PAYMENT.SALE.*` →
  `PAYMENT.CAPTURE.*`), so do it together with `routes/billing/paypalWebhook.ts`
  and the `pending_paypal_payments` idempotency keys, behind a sandbox test.
- [x] **ESLint 8 (EOL)** — both workspaces on ESLint 10 flat config
  (2026-11-15), rules ported 1:1 (identical linted-file sets; a probe file
  confirms every configured rule still fires). ESLint 10's new recommended
  rules surfaced 41 rethrows that dropped the original error (now
  `{ cause }`) and 23 dead stores; 17 stale `eslint-disable` comments
  removed. `react-hooks` stays on the two classic rules — its v7 React
  Compiler rules are a separate opt-in.

### Deployment pipeline (deploy-all.yml)
- [ ] **SSH as root** — code side done (2026-11-15): every SSH step's user comes
  from `TEST_DEPLOY_SSH_USER` / `PROD_DEPLOY_SSH_USER` (default `root`, so nothing
  changes until set), all host paths are `$HOME`-relative, and the few root-only
  host commands go through `sudo -n`. **Remaining (per host, you):** run
  `sudo ./scripts/provision-deploy-user.sh` on the server, set the variable,
  run a deploy, then set `PermitRootLogin no` (the script prints the steps).
  Note: docker-group access is root-equivalent; the gain is no root SSH login,
  a dedicated account in auth logs, and a 13-command sudo allowlist.
- [x] **Port 80/443 takeover** — fixed (2026-11-15): `scripts/free-web-ports.sh`
  no longer removes other projects' containers or kills unknown processes; it
  fails with a diagnostic instead (9 tests, run in CI).
- [ ] **On-host image builds** — images are built on the production host at
  deploy time. Building in CI and pulling by digest would shrink the workflow
  and keep build load off the server, but CLAUDE.md deliberately chose on-host
  builds with a local BuildKit cache to avoid GHCR auth and rate-limit problems.
  Needs an owner decision before changing; not changed.
- [x] **`|| true` audit** — done (2026-11-15). Network creation is now
  inspect-or-create; cache-purge failures raise `::warning`. The remaining
  suffixes are idempotent cleanup, diagnostics or optional reads; the
  convention is documented at the top of `deploy-all.yml`.

### Scope
- [ ] **501-prototype surface** — several route families return 501 by design
  (see README). Decide per family: promote (fund real integration), demote
  (move behind `FEATURE_*` flags, default off), or delete. Keeping them
  mounted inflates the attack/audit surface for no user value.
