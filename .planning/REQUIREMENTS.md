# Requirements — Architecture Hardening v1.1

> **Status:** v1.1 is **complete** — see `MILESTONE-v1.1-COMPLETE.md`. The table below records the original requirements and their outcomes.

## R1: Circular Dependency Elimination — ✅ Done
Break 6 import cycles in AI provider modules.
**Outcome:** `fallow` now reports **0 circular dependencies**.

## R2: Complexity Hotspot Refactoring — ✅ Done
Refactor top-5 cognitive-complexity hotspots to < 30 each (`chatbot.ts`, `App.tsx`, `analytics.ts`, `diagnostics.ts`, `EmailWorkflows.tsx`).
**Outcome:** all five decomposed (e.g. `App.tsx` 88 → 53 cognitive, `analytics.ts` 77 → ~40).

## R3: Dependency Hygiene — ✅ Done
Resolve unlisted dependencies, remove unused packages.
**Outcome:** audited — no unused packages.

## R4: Unused Export Cleanup — ✅ Done
Remove genuinely unused exports without breaking lazy-load entry points.
**Outcome:** 9 exports removed; 552 flagged as lazy-load false positives.

## R5: Code Duplication Reduction — ✅ Done
Reduce top clone groups (169 → ≤127).
**Outcome:** 13 clone groups eliminated (161 → 148, mostly low-value test files).

## R6: UI Quality Improvement — ✅ Audited (partial)
Raise standalone UI review from 14/24 toward ≥18/24.
**Outcome:** audit completed; minor issues noted (49 inline colors, spacing scale drift). Score not formally re-baselined — remaining work folded into future frontend polish.

## R7: Deployment Health — ✅ Done
Configure AI provider keys, commit rate-limit IPv6 fix, set up automated deployment.
**Outcome:** deployments healthy; CI/CD workflows in `.github/workflows/`.

## R8: Test Coverage — ✅ Done
Add unit tests for top hotspots + nexus-engine integration tests.
**Outcome:** 15 → **454 passing tests** across backend (346), frontend (103), and Python agents (5).

---

## Outstanding (carried into v1.3 / backlog)

- **6D: Coupling Reduction** — see `ROADMAP.md`
- **E2E (Playwright) into CI** — suite exists, not gated
- **Backend `npm audit` unblock** — `uuid` override conflict in `package.json`
- **Remaining complexity hotspots** — `FarmerMap.tsx`, extension sidepanel `App.tsx`, `CropsFields.tsx`, `LandingPage.tsx`
