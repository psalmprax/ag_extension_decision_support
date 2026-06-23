# Roadmap — Architecture Hardening v1.2

## Phase Dependency Graph

```
Phase 1 (API standardization) ──→ Phase 2 (error handling)
                                ──→ Phase 3 (performance)
Phase 1 + 2 ──────────────────→ Phase 4 (state consolidation)
Phase 1 + 2 + 3 + 4 ─────────→ Phase 5 (test coverage)
```

## Phases

### Phase 1: API Response Standardization
**Status:** Planned  
**Strategy:** Standardize all API responses to use consistent envelope format `{ success, data, error, message }`. Audit route handlers for inconsistent response shapes.

### Phase 2: Error Handling Consistency  
**Status:** Planned  
**Depends on:** None  
**Strategy:** Consolidate error handling patterns. Replace ad-hoc try/catch blocks with consistent middleware-based error handling. Add structured error codes.

### Phase 3: Performance Optimization
**Status:** Planned  
**Depends on:** None  
**Strategy:** Add database query optimization (indexing, N+1 query detection), implement response caching for frequently accessed endpoints, optimize bundle size.

### Phase 4: Frontend State Consolidation
**Status:** Planned  
**Depends on:** Phase 1, Phase 2  
**Strategy:** Consolidate scattered useState hooks into domain-specific custom hooks. Reduce prop drilling by leveraging context or Zustand store.

### Phase 5: Test Coverage Expansion
**Status:** Planned  
**Depends on:** Phase 1-4  
**Strategy:** Add integration tests for refactored services, unit tests for critical business logic, and E2E tests for key user flows.

---

# Milestone v1.3: Code Health Sprint

## Phase Dependency Graph

```
Phase 6A (dead code) ──→ Phase 6B (complexity decomposition)
                       ──→ Phase 6C (clone elimination)
Phase 6A + 6B ────────→ Phase 6D (coupling reduction)
```

## Phases

### Phase 6A: Dead Code Purge
**Status:** Planned  
**Strategy:** Remove 1,082 dead code issues identified by Fallow. Focus on:
- Unused exports in service files (shareService imports, getPool, etc.)
- Dead ad-hoc test scripts (already removed in this session)
- Unused variables in test files (mockQuery, mockGetPool, etc.)
- Unused middleware exports (setI18nConfig, getI18nConfig, getSupportedLanguages)
- Verify no false positives from lazy-load patterns before deleting

### Phase 6B: Complexity Decomposition
**Status:** Planned  
**Depends on:** None (can run parallel with 6A)  
**Strategy:** Decompose top 5 complex components identified by Fallow:
- `App.tsx` (cognitive: 53, 458 LOC) → Extract route config, auth logic, layout
- `BillingDashboard.tsx` (cognitive: 33, 422 LOC) → Extract billing forms, plan cards, invoice list
- `KnowledgeBase/index.tsx` (cognitive: 33, 411 LOC) → Extract search, upload, document list
- `FarmerDashboard.tsx` (cognitive: 42, 250 LOC) → Extract stats, charts, activity feed
- `AppHeader.tsx` (cognitive: 31, 274 LOC) → Extract nav items, user menu, notifications

### Phase 6C: Clone Elimination
**Status:** Planned  
**Depends on:** None (can run parallel with 6A, 6B)  
**Strategy:** Deduplicate 148 clone groups:
- AI provider pattern duplication (OpenAI, Anthropic, Groq, etc.)
- Billing route handler duplication (checkout, setup, intent patterns)
- Test file duplication (mock patterns, setup helpers)
- Extract shared utilities and base classes

### Phase 6D: Coupling Reduction
**Status:** Planned  
**Depends on:** Phase 6A, 6B  
**Strategy:** Reduce cross-module dependencies:
- `TabContent.tsx` imports 24 modules → Lazy-load tab content, use React.lazy
- Extract shared types to dedicated type files
- Create barrel exports for related modules
- Reduce direct imports between unrelated features
