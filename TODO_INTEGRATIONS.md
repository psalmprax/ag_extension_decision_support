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
