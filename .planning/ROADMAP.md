# Roadmap

## Milestone v1.1: Architecture Hardening — ✅ Complete

See `MILESTONE-v1.1-COMPLETE.md`. Delivered: 0 circular dependencies, top-5 complexity hotspots refactored, dead files removed, dependency hygiene audited, 13 clone groups eliminated, 15 new tests.

## Milestone v1.2: Architecture Hardening (extended) — 🗂 Superseded

The five planned phases below were never executed as a distinct milestone; work pivoted to the v1.3 code-health sprint. They remain valid candidates for future work:

1. API Response Standardization — envelope `{ success, data, error, message }`
2. Error Handling Consistency — middleware-based error handling + structured error codes
3. Performance Optimization — query indexing, N+1 detection, response caching, bundle size
4. Frontend State Consolidation — domain hooks, reduce prop drilling (Zustand already in use)
5. Test Coverage Expansion — integration tests, E2E for key flows

## Milestone v1.3: Code Health Sprint

```
Phase 6A (dead code) ──→ Phase 6B (complexity decomposition)
                       ──→ Phase 6C (clone elimination)
Phase 6A + 6B + 6C ───→ Phase 6D (coupling reduction)
```

| Phase | Status |
|-------|--------|
| 6A: Dead Code Purge | ✅ Complete |
| 6B: Complexity Decomposition | ✅ Complete |
| 6C: Clone Elimination | ✅ Complete |
| 6D: Coupling Reduction | ⏳ Pending — next |

### Phase 6D: Coupling Reduction (next)
**Strategy:**
- Lazy-load `TabContent.tsx` module imports (React.lazy / code-splitting)
- Extract shared types to dedicated type files; introduce barrel exports
- Reduce direct imports between unrelated features

## Remaining hotspots (from Fallow, verified 2026-08-18)

| File | Cognitive | LOC |
|------|-----------|-----|
| `frontend/src/components/FarmerMap.tsx` | 61 | 839 |
| `ag-extension-browser-ext/entrypoints/sidepanel/App.tsx` | 47 | 636 |
| `frontend/src/pages/CropsFields.tsx` | 35 | 811 |
| `frontend/src/pages/LandingPage.tsx` | — | 1,316 |
| `backend/scripts/ai-translate-all.ts` | 36 | 294 |

> Full prioritization: `npx fallow health` (maintainability 88.7, 740 functions above threshold).
