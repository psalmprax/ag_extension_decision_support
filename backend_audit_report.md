# Backend Audit Report: Remaining Incomplete/Mediocre Functionality

**Audit Date:** 2026-09-02  
**Scope:** `/ag-extension-dashboard/src/backend/src` (routes/, services/, tools/, workers/, middleware/, aiProvider/, agents/)  
**Excluded:** 14 deprecated pillar services, test files, explicitly-labeled demo/simulator code  
**Total Findings:** 22 (15-25 target range)

---

## HIGH Severity (Production-Blocking)

### 1. `routes/ai.ts:457-461` — Agent execute/stop endpoints return 501
**Feature:** AI Agent control plane (`POST /api/ai/execute`, `POST /api/ai/stop/:agentId`)  
**What's incomplete:** Both endpoints return HTTP 501 with error code `AGENT_EXECUTION_NOT_WIRED` / `AGENT_STOP_NOT_WIRED` when orchestrator dispatch fails. The fallback is silent — callers get "not configured" without knowing why.  
**Evidence:** 
```typescript
res.status(501).json({
    success: false,
    errorCode: unavailableCode[control],
    error: `${config.name} is reachable, but ${controlName} is not configured for this control plane.`,
});
```

### 2. `services/aiProvider/types.ts:197-230` — BaseAIProvider has 9 unimplemented abstract methods
**Feature:** AI Provider abstraction layer  
**What's incomplete:** `generateText`, `streamText`, `createEmbedding`, `createBatchEmbeddings`, `speechToText`, `textToSpeech`, `analyzeWithReasoning`, `classify`, `analyzeImage` all throw `Error('Method not implemented')`. Providers must override every method; no default implementations exist.  
**Evidence:**
```typescript
async generateText(_messages: any[], _options?: TextGenerationOptions): Promise<TextGenerationResult> {
    throw new Error('Method not implemented');
}
// ... 8 more methods identical
```

### 3. `workers/advisoryWorker.ts:20` — Advisory scheduler disabled by default
**Feature:** Daily agricultural advisory cycle (pest/disease/weather alerts)  
**What's incomplete:** Worker only starts if `ADVISORY_ENGINE_ENABLED=true` env var set. Default is disabled — no advisories sent in production unless explicitly enabled.  
**Evidence:**
```typescript
if (process.env.ADVISORY_ENGINE_ENABLED !== 'true') {
    logger.info('Advisory engine disabled (ADVISORY_ENGINE_ENABLED != true)');
    return;
}
```

### 4. `workers/ingestionWorker.ts:60,128` — Knowledge ingestion worker disabled by config
**Feature:** Automated scraping of CABI, FAO, IITA, FEWS NET, AfricaRice for knowledge base  
**What's incomplete:** `config.ingestion.enabled` defaults to `true` in code but requires `INGESTION_ENABLED=true` env. Worker logs "disabled in configurations" and exits silently. No ingestion runs unless configured.  
**Evidence:**
```typescript
if (!config.ingestion.enabled) {
    logger.info('Batch Ingestion is disabled in config.');
    return;
}
```

### 5. `services/verificationFraudService.ts:305` — OTP generation uses `Math.random()`
**Feature:** One-time password for farmer verification  
**What's incomplete:** `const otp = Math.floor(100000 + Math.random() * 900000).toString();` — not cryptographically secure. Predictable in Node.js if seed known.  
**Evidence:** Line 305 uses `Math.random()` for 6-digit OTP.

### 6. `services/weatherService.ts:250-257` — Hardcoded mock weather returned when no API key
**Feature:** Historical weather for parametric insurance auditing  
**What's incomplete:** Returns fixed values (22°C avg, 27°C max, 15°C min, 0mm precip) labeled "Offline / no-key mock estimate" — callers cannot distinguish mock from real data. No `dataStatus` field.  
**Evidence:**
```typescript
if (!apiKey) {
    return { date, avgTempC: 22.0, maxTempC: 27.0, minTempC: 15.0, totalPrecipMm: 0 };
}
```

---

## MEDIUM Severity (Deceptive/Incomplete Behavior)

### 7. `services/paymentAnalyticsService.ts:161` — `hasHistory` hardcoded `false` with TODO
**Feature:** Revenue metrics (MRR, ARR, expansion/contraction revenue)  
**What's incomplete:** Expansion/contraction revenue always returns `null` with meta `"unavailable — subscription_change_events not yet collected"`. Table doesn't exist; metric is permanently stubbed.  
**Evidence:**
```typescript
const hasHistory = false; // TODO: populate from subscription_change_events table when available
expansionRevenue: hasHistory ? 0 : null as unknown as number,
```

### 8. `services/paymentAnalyticsService.ts:230,387` — LTV and churn prediction simplified
**Feature:** Customer lifetime value & churn prediction  
**What's incomplete:** LTV = total revenue / total customers (no discounting, no cohort modeling). Churn prediction = customers with failed payments only (ignores engagement, support tickets, usage).  
**Evidence:**
```typescript
// Calculate LTV (simplified - average revenue per customer)
// Identify at-risk customers (simplified - customers with failed payments)
```

### 9. `services/crossBorderTradeService.ts:88-91` — DEMO freight & border fees hardcoded
**Feature:** Cross-border arbitrage opportunity detection  
**What's incomplete:** Distance fixed at 650km, freight at $0.075/km, border fees at $18.50/ton. Comment: "DEMO per-ton SPS + bond estimate (not tariff schedule)". No OSRM/HERE routing integration.  
**Evidence:**
```typescript
const distanceKm = 650;
const freightCost = +(distanceKm * 0.075).toFixed(2);
const borderFees = 18.5; // DEMO per-ton SPS + bond estimate (not tariff schedule)
```

### 10. `services/traceabilityPassportService.ts:111,114,131` — DEMO GTIN, unsalted hash, estimated carbon
**Feature:** GS1 Digital Link passport for commodity traceability  
**What's incomplete:** 
- GTIN hardcoded to `'06164000189214'` with comment "replace with tenant-registered value before production use"
- Digital signature uses unsalted SHA-256 "for display only; not a cryptographic attestation"
- Carbon footprint hardcoded to `0.85` with comment "ESTIMATED — requires lifecycle assessment, not measured"  
**Evidence:** Lines 111, 114, 131.

### 11. `services/mechanizationFleetService.ts:42-55` — DEMO equipment catalog returned as live data
**Feature:** Farm machinery rental marketplace  
**What's incomplete:** Returns hardcoded `[DEMO] Massey Ferguson 375` and `[DEMO] DJI Agras T30` entries. No DB backing; presented as real equipment listings.  
**Evidence:**
```typescript
modelName: '[DEMO] Massey Ferguson 375 (75 HP with Disc Plow)',
ownerName: '[DEMO] Peter Kiprono',
```

### 12. `services/pestSwarmRadarService.ts:120-131` — DEMO county list & advisory actions
**Feature:** Pest swarm trajectory forecasting & advisory dispatch  
**What's incomplete:** County list "illustrative"; advisory actions prefixed `[DEMO]` with comments "requires dispatch integration", "verify stock before mobilizing", "requires ministry integration". Returns actionable-looking output that does nothing.  
**Evidence:**
```typescript
'[DEMO] Issue 24h advisory (requires dispatch integration) to farmers in predicted corridor',
'[DEMO] Pre-position biopesticide — verify stock before mobilizing',
```

### 13. `routes/ai.ts:433` — Fire-and-forget worker kick loses errors
**Feature:** Agent task dispatch triggers background worker  
**What's incomplete:** `agentOrchestrator.executeNext().catch(() => {});` — errors swallowed completely. If worker fails, task stays queued but caller gets success.  
**Evidence:** Line 433.

### 14. `services/aiProvider/providers/huggingface.ts:54` & `nvidia.ts:54` — Silent catch returns `isConfigured()`
**Feature:** Provider health check  
**What's incomplete:** `catch { return this.isConfigured(); }` — on network error, returns configured status instead of `false`. Health check lies about availability.  
**Evidence:**
```typescript
} catch { return this.isConfigured(); }
```

### 15. `services/soilGridsService.ts:116` — Silent catch returns `false`
**Feature:** SoilGrids API availability probe  
**What's incomplete:** `catch { return false; }` — no logging, no error classification. Caller can't distinguish "service down" from "network blip" from "invalid coords".  
**Evidence:** Line 116.

### 16. `agents/main.py:414,544` & `crew_main.py:612` — `fallback_stub` data source & `[UNAVAILABLE]` placeholders
**Feature:** Agent Zero & Crew AI report generation  
**What's incomplete:** When AI unavailable, returns sections like `"[UNAVAILABLE] Live data for {region} is currently unavailable. This is a placeholder summary..."` with `data_sources=["fallback_stub"]`. Callers may treat as real analysis.  
**Evidence:** 
```python
data_sources=["fallback_stub"],
"Executive Summary": f"[UNAVAILABLE] Live data for {region} is currently unavailable. This is a placeholder summary..."
```

### 17. `services/bulkOperationsService.ts:48` & `agentTelemetry.ts:144` — `Math.random()` for ID generation
**Feature:** Bulk operation IDs & telemetry event IDs  
**What's incomplete:** `Math.random().toString(36).substr(2, 9)` — collision risk under load, not cryptographically unique. Use `crypto.randomUUID()` or ULID.  
**Evidence:**
```typescript
return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
```

### 18. `services/agentOrchestrator.ts:315` — Worker loop errors only warned
**Feature:** Background task execution loop  
**What's incomplete:** `this.executeNext().catch(err => logger.warn(...))` — failed tasks never retried, no alerting, no dead-letter queue. Silent degradation.  
**Evidence:** Line 315.

---

## LOW Severity (Technical Debt / Honesty Gaps)

### 19. `services/marketPriceService.ts:353-380` — Baseline prices labeled `estimated` but used as fallback
**Feature:** Market price fallback when live sources fail  
**What's incomplete:** Hardcoded USD prices for 4 crops (maize $32.4, beans $96.5, sorghum $29.3, millet $71 per 90kg). Honestly labeled `source: 'baseline_estimate', dataStatus: 'estimated'` but no staleness timestamp or confidence interval.  
**Evidence:** Lines 359-364.

### 20. `services/plantDiseaseService.ts:320,422` — Heuristic moisture & TF-IDF matcher labeled as internal
**Feature:** Plant disease diagnosis from symptoms  
**What's incomplete:** `estimatedMoisture: 'Unavailable'` returned when no sensor data. Diagnosis uses "Internal heuristic knowledge base (TF-IDF symptom keyword matcher) — not a laboratory or field-verified source". No confidence scoring.  
**Evidence:** Lines 320, 422.

### 21. `services/openMeteoSoilService.ts:7,59-60` — Modeled estimates labeled but no ground-truth alternative
**Feature:** Soil moisture/temperature from Open-Meteo ERA5 reanalysis  
**What's incomplete:** All responses carry `dataStatus: 'modeled_estimate'` and disclaimer "not a field sensor reading". No integration path for actual probe data.  
**Evidence:** Lines 7, 59-60.

### 22. `services/satelliteService.ts:19,114` — NDVI proxy labeled `estimated` but no satellite fallback
**Feature:** Satellite vegetation index  
**What's incomplete:** Returns NASA POWER temperature/precipitation proxy with `dataStatus: 'estimated'` and reason "this is not satellite NDVI". No Sentinel/Planet/Landsat integration attempted.  
**Evidence:** Lines 19, 114.

---

## Summary by Category

| Category | Count | Examples |
|----------|-------|----------|
| Routes returning 501/not implemented | 1 | `routes/ai.ts` agent control |
| Abstract methods throwing | 1 | `aiProvider/types.ts` (9 methods) |
| Workers disabled by default | 2 | `advisoryWorker`, `ingestionWorker` |
| Hardcoded DEMO/fake data in prod paths | 6 | cross-border, traceability, mechanization, pest radar, weather, OTP |
| Simplified/heuristic math without disclosure | 4 | payment analytics LTV/churn, market baseline, soil/NDVI proxies |
| Silent error swallowing | 4 | fire-and-forget worker, provider health checks, soilGrids probe |
| Math.random() for IDs/secrets | 3 | bulk ops, telemetry, OTP |
| Placeholder/stub in AI agents | 2 | Agent Zero, Crew AI fallback_stub |

---

## Recommended Priority Fixes

1. **P0:** Replace `Math.random()` OTP with `crypto.randomInt(100000, 999999)` in `verificationFraudService.ts`
2. **P0:** Implement `crypto.randomUUID()` for bulk/telemetry IDs
3. **P0:** Remove 501 fallback in `routes/ai.ts` — either wire orchestrator or return 503 with actionable error
4. **P1:** Enable advisory/ingestion workers by default with safe guards (feature flags, not env vars)
5. **P1:** Add `dataStatus` field to weather service mock response
6. **P1:** Replace DEMO GTIN/hash/carbon in traceability with tenant-configurable values + warnings
7. **P2:** Implement `subscription_change_events` table for payment analytics expansion/contraction
8. **P2:** Add OSRM/HERE routing to cross-border trade service
9. **P2:** Convert silent catches to logged warnings with error codes
10. **P3:** Add confidence intervals to heuristic estimates (market baseline, soil proxies, NDVI)