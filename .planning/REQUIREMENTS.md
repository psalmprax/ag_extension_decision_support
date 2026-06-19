# Requirements — Architecture Hardening v1.1

## R1: Circular Dependency Elimination
**Priority:** Critical  
**Effort:** Medium  

Break 6 import cycles in AI provider modules:
- `aiProvider.ts` ↔ `googleVertex.ts`
- `aiProvider.ts` ↔ `azureOpenAI.ts`  
- `aiProvider.ts` ↔ `openAI.ts`

**Acceptance:** `fallow dead-code` shows 0 circular_dependencies. All AI provider tests pass.

## R2: Complexity Hotspot Refactoring
**Priority:** High  
**Effort:** High  

Refactor top-5 cognitive complexity hotspots to < 30 each:

| File | Current | Target | LOC |
|------|---------|--------|-----|
| `chatbot.ts` arrow fn | 94 | < 30 | 509 |
| `App.tsx` App component | 88 | < 30 | 531 |
| `analytics.ts` arrow fn | 77 | < 30 | 633 |
| `diagnostics.ts` arrow fn | 40 | < 30 | 192 |
| `EmailWorkflows.tsx` | 32 | < 30 | 759 |

**Acceptance:** Fallow shows 0 complexity findings above threshold for these 5 files. No behavior regressions.

## R3: Dependency Hygiene
**Priority:** High  
**Effort:** Medium  

- Resolve 76 unlisted dependencies (add to package.json or remove ghost imports)
- Remove 4 unused dependencies from package.json
- Run `npm install` to update lockfile

**Acceptance:** `fallow dead-code` shows 0 unlisted_dependencies and 0 unused_dependencies.

## R4: Unused Export Cleanup
**Priority:** Medium  
**Effort:** High  

Clean 581 unused exports across backend and frontend. Triage carefully:
- Backend: Many exported service functions may be used via `@/` path aliases (false positives)
- Frontend: Barrel-exported components may be entry points (false positives)
- Target: Remove 200+ genuinely unused exports without breaking anything

**Acceptance:** `fallow dead-code --unused-exports` reduced by ≥ 35%. Build passes.

## R5: Code Duplication Reduction
**Priority:** Medium  
**Effort:** Medium  

Address top-10 clone groups from 169 total:
- AI provider files (googleVertex, azureOpenAI, openAI, anthropic) share significant boilerplate
- Extract shared provider base class or utility functions

**Acceptance:** `fallow dupes` reduced by ≥ 25% (from 169 to ≤ 127).

## R6: UI Quality Improvement
**Priority:** Medium  
**Effort:** Medium  

Based on standalone UI review (14/24):

| Pillar | Current | Target | Actions |
|--------|---------|--------|---------|
| Copywriting | 2/4 | 3/4 | Standardize i18n, eliminate hardcoded strings |
| Color | 2/4 | 3/4 | Reduce 114 hardcoded hex/rgb to design tokens |
| Typography | 2/4 | 3/4 | Limit to 4 font sizes max |
| Spacing | 2/4 | 3/4 | Replace 295 arbitrary px/rem with spacing scale |

**Acceptance:** UI review score ≥ 18/24.

## R7: Deployment Health
**Priority:** High  
**Effort:** Low  

- Configure AI provider API keys on production server
- Commit rate-limit IPv6 fix to source (currently only on server)
- Set up automated deployment pipeline (build → test → deploy)

**Acceptance:** Health endpoint returns `status: healthy`. All services connected.

## R8: Test Coverage
**Priority:** Medium  
**Effort:** High  

- Add unit tests for top-5 complexity hotspots (post-refactor)
- Add integration tests for nexus engine (agent dispatch, handoff, queue)
- Target: Reduce CRAP scores on refactored files below 30

**Acceptance:** Fallow health shows CRAP scores < 30 for all refactored hotspots.
