# State — Code Health Sprint v1.3

**Current focus:** 6D (Coupling Reduction) — pending  
**Milestone:** Code Health Sprint v1.3  
**Last updated:** 2026-08-18  
**Previous:** v1.1 completed — see `MILESTONE-v1.1-COMPLETE.md`

## Phase Status

### v1.3 Code Health Sprint
| Phase | Status | Notes |
|-------|--------|-------|
| 6A: Dead Code Purge | ✅ Complete | Removed unused exports/functions and ad-hoc test scripts |
| 6B: Complexity Decomposition | ✅ Complete | Top hotspots decomposed (App, BillingDashboard, KnowledgeBase, FarmerDashboard, AppHeader) |
| 6C: Clone Elimination | ✅ Complete | AI-provider and billing-route clone groups deduplicated |
| 6D: Coupling Reduction | ⏳ Pending | Lazy-load `TabContent` imports, extract shared types/barrels |

### v1.2 Architecture Hardening (superseded)
Planned phases (API standardization, error handling, performance, state consolidation, test coverage) were **not executed** — the team pivoted to the v1.3 code-health sprint instead. These remain candidates for future work but are no longer tracked as active phases.

## Metrics Baseline (verified 2026-08-18)

| Metric | Value |
|---|---|
| Fallow maintainability | 88.7 (good) · health score 84/B |
| Analyzed LOC | 79,951 |
| Dead files / dead exports | 7.0% / 9.2% (29 files, 92 exports) |
| Duplication | 5.3% (4,222 lines, 100 files) |
| Circular dependencies | 0 |
| Large functions (>60 LOC) | 227 |
| Functions above complexity threshold | 740 / 3,633 |
| Backend tests | 346 passing (40 suites) |
| Frontend tests | 103 passing (23 files) |
| Python agent tests | 5 passing |
| Backend typecheck | Clean |
| Frontend typecheck | Clean |
| Backend lint | Clean (sonarjs cognitive-complexity ≤ 15) |
| Frontend lint | Clean |
| Frontend vulns | 0 |
| Backend vulns | 0 (audit clean — uuid override conflict resolved 2026-08-19) |

## Session Progress (2026-08-18)

### Completed
- ✅ Fixed frontend typecheck error (`useDeviceThermalMemoryBudget.ts` — `nav.connection` possibly undefined)
- ✅ Refactored 8 backend functions to pass the sonarjs cognitive-complexity gate:
  - `app.ts` — `checkAIProvider` (extracted fallback/cascade helpers), `healthHandler` (extracted `resolveHealthStatus`)
  - `index.ts` — `bootstrap` (extracted `initializeStep` helper, removed 16 duplicated try/catch blocks)
  - `anthropic.ts` / `openAI.ts` — extracted `buildUserContent`
  - `faostatService.ts` — extracted `groupByElement` + `formatCropSummary`
  - `agronomicSafetyGuard.ts` — extracted `detectQuarantineConditions` + `computeHazardLevel`
  - `skillVetter.ts` — extracted `classifyPattern`
  - Test mocks — replaced `any` with typed `MockRequest`/`MockResponse`
- ✅ Removed 21 committed debris files (numeric artifacts `30`/`60`/`120`/`300`, `lint_output.txt`, `run_logs*.txt`, lint snapshots, `check_output.txt`, `compliance_output.txt`, `test-failure.png`) and added gitignore rules
- ✅ Regenerated README + `.planning/` docs to match current reality

## Known Issues

1. **Remaining complexity hotspots (untested, high CRAP):** `FarmerMap.tsx` (61 cognitive), extension sidepanel `App.tsx` (47), `CropsFields.tsx` (35), `LandingPage.tsx` (1,316 LOC).
2. **E2E (Playwright) not in CI** — suite exists but is not gated in `.github/workflows/`.
3. **Test coverage gaps** — most high-complexity UI components have `coverage_tier: none`.

> ✅ **Resolved (2026-08-19):** the backend `npm audit` EOVERRIDE conflict is gone. Commit `4dc9b989` aligned the direct `uuid` dependency to `^11.1.1` (matching the override), and `npm audit --audit-level=high` now exits 0 with 0 vulnerabilities.
