# Knowledge Base: Real-Time Research Loop & Quota Fix — Implementation Plan

**Goal:** Make RAG → LLM deliver *up-to-date, browsed, citable* answers (not single-shot RAG with top-3 stale contexts) and fix `DAILY QUOTA: 999999/-1` → `3/3` for free tier.

**Status:** Planned, not yet implemented. Covers only `KnowledgeService.askQuestion` and `routes/knowledge.ts` + `components/KnowledgeBase/index.tsx`. No infra changes.

---

## 1. Current State (verified first-hand, not docs)

**Flow `services/knowledgeService.ts:594` `askQuestion`:**
1. `checkCaches:126` — Redis exact key `ask:{normalized}` → DB `search_cache.normalized_query` → `SemanticCacheService.findSimilar` (single embedding). Any hit returns `cached:true` with **no re-retrieval**, `24h` TTL, no freshness check. Market/weather queries can be served stale.
2. `fetchUserAndFarmerContext:328` + `fetchWeatherContext:334`/`FAO:361`/`NASA:379`/`SoilGrids:402` — each appends a `SearchResult(score:1.0)` **only if** `lat/lon` exists and `queryCategories` matches. Many farmer queries lack geo, so no live context.
3. `VectorService.hybridSearch:37` (RRF `1/(60+rank)`, gate `score>=0.65:259`). If low → **one-shot fallback** either `StealthScraperService.scrapeKnowledge:185` (single `platform` chosen by `queryCategories` string match, 30s race, maps to 0.5-scored synthetic `SearchResult:208`) **or** `Tavily 3 results:231`. Not both. No rerank on the fallback path.
4. Single `AIRouter.routeRequest('reasoning', {queryText, contextResults})` → `postProcessResponse:503` `validateAndEnhanceVisuals` + optional `TTS` + `RAGV2Service.enhancedSearch:888` for citations (limit 3, `useReranking:false`).
5. `cacheAndLogResponse:544` `Redis setex 24h` + `SemanticCache.save`.

**Quota bug `services/usageService.ts:221` + `routes/knowledge.ts:37` `GET /quota`:**
- `checkDailyKnowledgeLimit` returns `{limit:-1, remaining:999999}` for `!isFree` (Pro/Admin). `isFreeUser:115` returns `false` for any `role==='admin'` **and** for DB `user.role==='admin'`, but also for free-tier farmers whose `subscription.plan.name` is `"Free Plan"` (exact `"free"` check fails, `price` may be `null`). Frontend `KnowledgeBase/index.tsx:551` renders `{quota.remaining}/{quota.limit}` verbatim → `999999/-1` even for farmers who should see `3/3`.
- `POST /ask:859` admin bypass `limit:-1` is correct to not block admins, but `GET /quota` should never show `-1` to a farmer.

## 2. Desired State (how SOTA research works)

* **Agentic ReAct loop** (Perplexity/Deep Research): planner rewrites query → `search` → `fetch` → `rerank` → `synthesize` → `self-critique` → repeat 2–3× until `evidenceStatus==='verified_sources'` or budget. Every claim gets a `sourceUrl + fetchedAt`.
* **Always-fresh web + rerank:** `Tavily search_depth:advanced, time_range:week, include_answer:false` + `Jina Reader` per URL + `Cohere rerank` (you already have `RAGV2Service useReranking` — disabled in ask). `SemanticCache` bypass for `market`/`weather` intents.
* **Quota UX:** Free `3/3 → 2/3 → …`, Pro/Admin `Unlimited` chip, not `999999`.

## 3. Plan (3 phases, each shippable)

### Phase 0 — Quota Fix (P0, <30 min, touches 3 files, no migration)
- `services/usageService.ts:115` `isFreeUser` → `planName.includes('free')` + `price==null||price===0` fallback; also handle `!data.plan` free case robustly.
- `routes/knowledge.ts:37` `GET /quota` → if `!isFree` return `{limit: -1, remaining: -1, isFree:false}` **and** frontend hides numeric quota for non-free.
- `components/KnowledgeBase/index.tsx:547` quota chip → `isFree ? {remaining}/{limit} : Unlimited` + `quota.remaining===0` shows Upgrade. Also fix `POST /ask:859` admin bypass to not leak `-1` into `dailyRemaining` for farmers.
- **Verify:** `npm test` `usageService.test`, manual `curl /knowledge/quota` as farmer (expect `3/3`) and admin (expect `Unlimited`).

### Phase 1 — Always-Fresh Retrieval (P1, 1 file, no loop yet)
- `services/knowledgeService.ts:253` `enrichContextWithWebFallbacks` → **always** `Tavily(5, search_depth:advanced, time_range:week, include_answer:false)` + `Jina Reader` per URL, then `RAGV2Service useReranking:true` over `local + web` (12 candidates → top 4). Cache key includes `time_range`.
- `SemanticCacheService.findSimilar` bypass when `queryCategories` contains `market_and_commodity_prices` or `climate_and_weather` (real-time intents).
- Add `fetchedAt` to every `SearchResult.metadata` (`tavily.publishedDate` or `new Date().toISOString()`), surface in `AIResult` citations.
- **Verify:** `npm test` `knowledgeService.test` with `tavilyService` mock, `curl /knowledge/ask?q=maize price today` returns `citations[0].excerpt` with `publishedDate` within 7d.

### Phase 2 — Agentic Loop (P1, 1 file, reuse `mcpAdapter`)
- Port `routes/chatbot.ts:580` loop into `KnowledgeService.askQuestion`: `mcpAdapter.convertToMCPTools()` exposes `searchKnowledge`, `tavilySearch`, `stealthScrape`, `fetchWeather/FAO/NASA/Soil`. LLM now tool-calls (`AIRouter` with `tools` + `tool_choice:auto`) up to 4 turns, 40s budget, until `evidenceStatus==='verified_sources'` or `toolCalls===0`.
- Prompt change: `"You have tools; call them to gather fresh evidence before answering. Cite sourceUrl for every claim."`
- Keep existing `cacheAndLogResponse` but key includes `toolsUsed` hash.
- **Verify:** `npm test` new `agenticLoop.test` (mock `mcpAdapter.callTool` sequence), manual `curl /knowledge/ask` with `?v2=true` shows `usedTools: ["tavilySearch","fetchWeatherContext"]` in response.

### Phase 3 — Eval & Guardrails (P2)
- Tighten `getKnowledgeEvidenceStatus:17` to `verified_sources` only if `citations.length>=2 && maxScore>=0.75`, else `context_only`.
- Add `limit: -1` display test `knowledgeQuota.test`.
- Add `reasoningTimeout` (existing `498`) per-tool timeout 8s.

## 4. Verification Checklist (must pass before merge to `stage`)
- `npm run build` backend + frontend
- `npm test` `usageService`, `knowledgeService`, `vectorService` (mock Redis/DB)
- `curl /knowledge/quota` as free farmer → `{"remaining":3,"limit":3,"isFree":true}`; as admin → `{"remaining":-1,"limit":-1,"isFree":false}` and UI shows `Unlimited`
- `curl /knowledge/ask` `{"question":"maize price Nairobi today"}` → `citations[0].fetchedAt` within 7 days, `evidenceStatus` correct, `cached:false` on first hit, `cached:true` on immediate repeat but with `freshness:stale` header

## 5. Rollback
Revert single commit; no migration. Feature-flag `KNOWLEDGE_AGENTIC_LOOP=false` keeps Phase 0/1 live even if Phase 2 is reverted.
