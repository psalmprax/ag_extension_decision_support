---
name: scraper-debug
description: Debug and troubleshoot the stealth scraper, CloakBrowser, Agent Zero service, and batch ingestion worker. Use when investigating scraping failures, Agent Zero connectivity, ingestion worker issues, or CloakBrowser platform detection.
---

# Scraper / Ingestion Debugging

## Quick Diagnostics

```bash
# Check Agent Zero health
curl http://localhost:8000/health

# Test stealth scrape endpoint
curl -X POST http://localhost:8000/api/execute \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"task_type": "stealth_scrape", "parameters": {"niche": "maize fall armyworm", "platform": "cabi_plantwise", "region": "Global Tropics"}}'

# Check ingestion worker logs
docker compose logs backend | grep -i "ingestion\|batch\|crawl\|scraper"
```

## Architecture

### Scraper Stack

```
Backend (Node.js)
  -> StealthScraperService.scrapeKnowledge()
    -> HTTP POST to Agent Zero (Python FastAPI)
      -> /api/execute endpoint, task_type: "stealth_scrape"
      -> CloakBrowserScanner
        -> Platform-specific scrapers (Playwright-based)
    -> Returns ScrapedTrend[] (topic, velocity, sentiment, keywords, summary, url)
```

### Ingestion Worker

```
startIngestionWorker()
  -> Runs on server start (15s delay)
  -> First crawl: 30s after worker start
  -> Recurring: daily or weekly (config.ingestion.schedule)
  -> 19 hardcoded INGESTION_TASKS (cabi_plantwise, fao_crop_guides, iita_agronomy, fews_net, africarice)
  -> 5s delay between tasks (rate limit protection)
```

## Key Files

| File | Purpose |
|---|---|
| src/backend/src/services/stealthScraperService.ts | Node.js bridge to Agent Zero |
| src/backend/src/workers/ingestionWorker.ts | Batch ingestion worker with 19 tasks |
| src/agents/main.py | Agent Zero FastAPI service |
| src/agents/tools/cloakbrowser/ | CloakBrowser stealth scraper |

## Common Issues

### Agent Zero unreachable
StealthScraperService.AGENT_URL defaults to http://ag-agent-zero:8000.
```bash
docker compose ps ag-agent-zero
docker compose exec backend curl http://ag-agent-zero:8000/health
```

### Stealth scrape returns empty
Possible: platform site changed, IP blocked, CloakBrowser detection triggered, Agent Zero returned success: false.

### Ingestion worker not starting
config.ingestion.enabled must be true. Server must be running.

### Duplicate ingestion runs
isIngesting flag prevents concurrent runs. Articles use ON CONFLICT (id) DO UPDATE — safe.

### Agent Zero auth failure
StealthScraperService sends Bearer dev-token. Agent Zero must accept this in dev mode.
