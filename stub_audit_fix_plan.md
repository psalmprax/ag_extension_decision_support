# Stub Audit Remediation Plan

## Goal

Remove fabricated or falsely live production behavior identified during the source-only audit. Preserve explicitly labeled demo and simulator functionality.

## Scope

### 1. Fraud alerts

- Replace the hardcoded `/api/verification/fraud-alerts` response in `ag-extension-dashboard/src/backend/src/routes/verificationFraud.ts` with data derived from persisted records.
- Use the existing `alerts` table for persisted alert records and derive geofence-breach records from persisted visits with officer GPS and farmer parcel coordinates where applicable.
- Return an empty alert list when no evidence exists; never invent officer, farmer, distance, timestamp, or integrity data.
- Add focused route/service tests for empty results and real persisted geofence evidence.

### 2. Video generation prototype

- Retire the unreferenced `VideoGenerationService` success path in `ag-extension-dashboard/src/backend/src/services/videoGenerationService.ts` because it creates neither assets nor a render job while reporting `processing`.
- Keep the already implemented bounded video-analysis path separate and intact.
- Add a regression check ensuring no production path reports a render job without a real renderer.

### 3. Alert worker placeholders

- Remove the no-op payment-due check from the scheduled worker, since subscription-expiry handling already exists and the current function only logs success.
- Implement weather alert evaluation using the existing `WeatherService`, with bounded region processing, explicit unavailable-data handling, and notifications only for detected severe conditions.
- Add tests for weather alert detection and for no notification when weather data is unavailable or non-severe.

### 4. Crop-yield forecast correctness

- Extend the weather forecast contract to include daily precipitation from Open-Meteo.
- Replace the `sum + 0` rainfall calculation in `cropYieldForecastTool.ts` with a sum of actual precipitation values.
- Add tests proving rain changes the score and that missing precipitation is treated as unknown/conservative rather than silently as zero.

### 5. Satellite and external-data truthfulness

- Remove mathematically generated historical NDVI time series from `SatelliteService`; return an explicit unavailable result until a real historical imagery query is implemented.
- Stop converting missing NASA NDVI data to `0.5`; return no observation or an explicit unavailable status.
- Mark imagery cloud cover as unknown when it is not supplied by the provider.
- Add source/status metadata to satellite results and update `SatelliteInsights.tsx` to display estimated, unavailable, or provider-backed data accurately instead of always showing `Active Scan` and `Source: Sentinel-2 MSI`.
- Change SoilGrids failure fallback from fixed unlabeled soil measurements to an explicit unavailable result with source/status metadata.
- Preserve the market-price estimate path but remove request-time table deletion/reseeding so concurrent users cannot overwrite each other's data; retain its existing `baseline_estimate` labeling.

### 6. FAOSTAT fallback provenance

- Keep static historical country data only as an explicitly labeled fallback.
- Propagate `source` and `sourceUrl` from `FaostatService` into `KnowledgeSyncOrchestrator` instead of always storing `source: 'FAOSTAT API'`.
- Correct the confirmed malformed static Ethiopia potato entry and add provenance-focused tests.

### 7. Frontend fallback removal

- Remove fabricated fallback agents, queue totals, handoff records, SMS contacts/history/quota, and satellite priority/synthesis from:
  - `ag-extension-dashboard/src/frontend/src/pages/Agents.tsx`
  - `ag-extension-dashboard/src/frontend/src/pages/SMS.tsx`
  - `ag-extension-dashboard/src/frontend/src/components/SatelliteInsights.tsx`
- Render clear empty/unavailable states and preserve retry/refresh actions.
- Do not alter `DemoPage`, `demoData.ts`, `USSDSimulatorDrawer.tsx`, or other explicitly labeled simulators.

## Verification

- Add or update focused backend tests for fraud alerts, weather scoring, satellite unavailable states, SoilGrids fallback status, FAOSTAT provenance, and market-price concurrency-safe behavior.
- Add or update frontend tests for unavailable agent, SMS, and satellite states.
- Run backend build, typecheck, lint, and full tests.
- Run frontend typecheck, lint, and full tests.
- Run `git diff --check` and perform a final search for hardcoded production fraud alerts, mock render-job success, `sum + 0`, generated NDVI history, and unlabeled fallback records.

## Risks and Decisions

- No fraud-alert schema is currently present, so the implementation must use existing persisted alerts and visit evidence rather than inventing a new unsupported record format.
- Historical satellite NDVI will be unavailable until backed by a real provider query; an empty state is safer than a generated series.
- Demo and simulator code remains intentionally synthetic because it is explicitly labeled and isolated from live API calls.
