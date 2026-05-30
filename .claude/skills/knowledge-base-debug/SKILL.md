---
name: knowledge-base-debug
description: Debug the Knowledge Base page (frontend + backend integration). Use when knowledge search returns no results, ask-AI fails, sidebar/history doesn't load, stats are wrong, attachments don't work, or the page has rendering issues.
---

# Knowledge Base Page Debugging

## Quick Diagnostics

```bash
# Test knowledge search API
curl -s "https://www.gpexts.com/api/v1/knowledge/search?q=maize" | jq '.data | {total, articleCount: (.articles | length)}'

# Test ask-AI endpoint (needs auth token)
curl -s -X POST "https://www.gpexts.com/api/v1/knowledge/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"How to control fall armyworm?"}' | jq '.data | {answerLen: (.answer | length), contextCount: (.contextUsed | length), cached}'

# Test knowledge stats
curl -s "https://www.gpexts.com/api/v1/knowledge/stats" | jq .

# Check backend logs for knowledge errors
ssh root@145.223.97.248 "docker logs ag-dashboard-backend --tail=50 2>&1 | grep -i 'knowledge\|vector\|search\|embedding'"
```

## Architecture

### Frontend Components

```
KnowledgeBase/
  ├── index.tsx              ← Main page: search bar, ask-AI, results, attachments
  ├── KnowledgeSidebar.tsx   ← Left panel: history, category/crop filters, logout
  ├── KnowledgeStats.tsx     ← Stats cards: total articles, searches, categories
  └── ReasoningVisuals.tsx   ← KPI cards, charts, images from AI response
```

### API Flow

```
Frontend                    Backend
─────────                   ───────
searchKnowledge(q)    →     GET  /api/v1/knowledge/search
askAI(question)       →     POST /api/v1/knowledge/ask
fetchKnowledgeHistory →     GET  /api/v1/knowledge/history
fetchKnowledgeStats   →     GET  /api/v1/knowledge/stats
```

### Backend Pipeline (knowledge/ask)

```
1. Check exact DB cache (knowledge_searches table)
2. Check semantic cache (SemanticCacheService)
3. If miss:
   a. VectorService.hybridSearch() — vector + keyword + RRF
   b. Stealth scraper fallback (if agricultural query)
4. Build context from results
5. AIRouter.routeRequest('reason', ...) — generate answer
6. Cache result, log search
7. Return { answer, contextUsed, cached, visuals, audio }
```

## Key Files

| File | Purpose |
|---|---|
| src/frontend/src/components/KnowledgeBase/index.tsx | Main page component |
| src/frontend/src/components/KnowledgeBase/KnowledgeSidebar.tsx | History + filters |
| src/frontend/src/components/KnowledgeBase/KnowledgeStats.tsx | Stats display |
| src/frontend/src/components/KnowledgeBase/ReasoningVisuals.tsx | KPI/charts/images |
| src/frontend/src/api/knowledgeService.ts | Frontend API layer |
| src/backend/src/routes/knowledge.ts | Backend routes |
| src/backend/src/services/knowledgeService.ts | Core knowledge logic |
| src/backend/src/services/vectorService.ts | Vector/hybrid search |
| src/backend/src/services/semanticCacheService.ts | Semantic cache |

## Common Issues

### Search returns 0 results
1. Check knowledge_articles has data with embeddings:
   ```sql
   SELECT COUNT(*) FROM knowledge_articles WHERE embedding IS NOT NULL;
   ```
2. Check embedding dimension matches query dimension (see rag-knowledge-debug)
3. Lower minScore — default 0.4 may be too high for some queries

### Ask-AI returns empty or error
1. Check AI provider health: `curl /api/health | jq '.services.ai_provider'`
2. Check backend logs for KnowledgeService errors
3. If Ollama is the provider, verify ettametta-ollama container is running

### Sidebar history not loading
1. fetchKnowledgeHistory() requires auth token
2. Check knowledge_searches table has rows
3. Check browser console for 401/403 errors

### Stats show 0 articles
1. Knowledge base hasn't been seeded or ingestion hasn't run
2. Check: `SELECT COUNT(*) FROM knowledge_articles;`
3. Ingestion worker auto-starts 15s after server boot (if enabled)

### Attachments not working
1. Frontend sends attachments as {type, data (base64), name, mimeType}
2. Backend passes to AI provider's analyzeWithReasoning
3. Only OpenAI and Azure support image attachments natively

### Audio/TTS not playing
1. POST /knowledge/tts with {text, language}
2. Uses AI provider's textToSpeech()
3. Only Azure and OpenAI support TTS — Ollama does not

### Category/Crop filters not working
1. Filters sent as query params: ?category=pest_and_disease&crop=maize
2. Backend applies $4 = ANY(crops) filter
3. Articles tagged 'All' won't match specific crop filters

### Page rendering issues
1. Uses framer-motion for animations — check for JS errors
2. useDesignSystemMode() toggles modern/classic theme
3. MarkdownRenderer uses react-markdown + remark-gfm
