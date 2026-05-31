---
name: rag-knowledge-debug
description: Debug and troubleshoot the RAG knowledge system. Use when investigating vector search failures, hybrid search issues, knowledge ingestion problems, embedding dimension mismatches, or low search relevance.
---

# RAG / Knowledge System Debugging

## Quick Diagnostics

```bash
# Check knowledge article count
docker compose exec app-db psql -U postgres -d ag_extension -c "SELECT COUNT(*) FROM knowledge_articles;"

# Check embedding dimensions in DB
docker compose exec app-db psql -U postgres -d ag_extension -c "SELECT array_length(embedding, 1) as dim FROM knowledge_articles WHERE embedding IS NOT NULL LIMIT 1;"

# Check recent searches
docker compose exec app-db psql -U postgres -d ag_extension -c "SELECT query, category, created_at FROM knowledge_searches ORDER BY created_at DESC LIMIT 10;"

# Check ingestion worker status
docker compose logs backend | grep -i "ingestion\|batch\|crawl"
```

## Architecture

### Search Pipeline

```
User Query
  -> KnowledgeService.searchKnowledge()
    -> VectorService.hybridSearch()
      -> VectorService.search()        [cosine similarity via custom SQL function]
      -> VectorService.keywordSearch() [PostgreSQL full-text search]
      -> Reciprocal Rank Fusion (RRF)  [merge results, k=60]
      -> minScore filter (default 0.4)
    -> Return top N results
```

### Ingestion Pipeline

```
IngestionWorker (scheduled daily/weekly)
  -> 19 hardcoded INGESTION_TASKS
    -> StealthScraperService.scrapeKnowledge()
      -> Agent Zero /api/execute (Python FastAPI)
        -> CloakBrowser stealth scraping
    -> VectorService.upsertDocument()
      -> AIRouter.routeRequest('embed', ...)
      -> INSERT INTO knowledge_articles
```

### Knowledge Categories

| Category | Sources |
|---|---|
| pest_and_disease | CABI Plantwise (7 crops) |
| agronomy_and_yield | FAO Crop Guides, IITA, AfricaRice |
| climate_and_weather | FEWS NET |

## Key Files

| File | Purpose |
|---|---|
| src/backend/src/services/vectorService.ts | Vector store: upsert, search, hybrid search, keyword search |
| src/backend/src/services/knowledgeService.ts | High-level knowledge API: search, log, history, stats |
| src/backend/src/services/semanticCacheService.ts | Semantic caching layer |
| src/backend/src/workers/ingestionWorker.ts | Batch ingestion worker (19 scrape tasks) |
| src/backend/src/services/stealthScraperService.ts | Stealth scraper bridge to Agent Zero |
| src/backend/src/routes/knowledge.ts | Knowledge API routes |

## Search Modes

| Mode | Method | How It Works |
|---|---|---|
| Vector | VectorService.search() | Cosine similarity via custom cosine_similarity() SQL function |
| Keyword | VectorService.keywordSearch() | PostgreSQL to_tsvector + to_tsquery full-text search |
| Hybrid | VectorService.hybridSearch() | RRF fusion of vector + keyword results |

## Common Issues

### Vector search returns 0 results

**Cause 1**: Embedding dimension mismatch
```sql
SELECT array_length(embedding, 1) as dim FROM knowledge_articles WHERE embedding IS NOT NULL LIMIT 1;
```

**Cause 2**: minScore too high (default 0.4). Lower it: `VectorService.search(query, 5, {}, 0.2)`

**Cause 3**: No embeddings in DB
```sql
SELECT COUNT(*) FROM knowledge_articles WHERE embedding IS NOT NULL;
```

### Ingestion worker not running
Check: config.ingestion.enabled must be true. Worker auto-starts 15s after server boot.

### Agent Zero unreachable during ingestion
StealthScraperService calls AGENT_ZERO_URL (default: http://ag-agent-zero:8000). If down, scrapes return empty arrays silently.

### Knowledge seeding
VectorService.seedKnowledge() only seeds if count < 15. To force re-seed:
```sql
DELETE FROM knowledge_articles WHERE source = 'AG Extension Tropical Agronomy Seed';
```

### Full-text search returning nothing
Keyword search sanitizes: removes non-alphanumeric, joins with &. Words < 3 chars filtered.
