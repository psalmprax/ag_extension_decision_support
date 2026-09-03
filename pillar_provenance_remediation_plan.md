# Pillar Services — Provenance & De-Fabrication Remediation Plan

**Date:** 2026-09-03
**Scope:** `ag-extension-dashboard/src/backend/src/services/*pillar*`, `routes/pillars.ts`, related workers/agents
**Related docs:** `backend_audit_report.md`, `stub_audit_fix_plan.md`, `stub_audit_fix_round2_plan.md`

---

## Problem Statement

The "pillar" service layer (traceability, credit/insurance, trade, offtake, mechanization, IoT, NDVI, IVR, carbon, ROI, suppliers) serves deterministic computations over **caller inputs mixed with hardcoded constants and in-code demo directories**. Until now, responses did not distinguish the two. Specific fabrications:

| # | Service | Fabrication | Risk |
|---|---------|-------------|------|
| 1 | `agronomicRoiService.ts` | Default yields 2.4/4.6 t/ha applied to any crop; `executiveSummary` generated a +91.7% claim from constants | Financial decision made on invented yields |
| 2 | `traceabilityPassportService.ts` | EUDR audit defaulted canopy to 12.0/12.0 → missing evidence **passed as `compliant_for_eu_export`** | Regulatory fail-open |
| 3 | `ivrBroadcastService.ts` | `dispatchedCount = N` with `provider: 'log_only'` when nothing was sent | Phantom success for calls never made |
| 4 | `pestSwarmRadarService.ts` | Hardcoded `[Nakuru, Baringo, Laikipia]` impact counties; `[DEMO] …requires dispatch integration` actions | Actionable-looking strings that do nothing |
| 5 | `crossBorderTradeService.ts` | Fixed 650km distance, $0.075/km freight, $18.50 border fees; static price snapshot presented as live spread | Trade signal on fictional logistics |
| 6 | `harvestOfftakeService.ts` | Fixed yields/prices/harvest window; 3 hardcoded "accredited buyers" | Fabricated counterparty offers |
| 7 | `mechanizationFleetService.ts` | Two `[DEMO]` assets returned as live availability | Fictional rental listings |
| 8 | `agriCreditInsuranceService.ts` | Loan ceilings KES 25k–95k/acre presented without disclosure | Pseudo-lending numbers |
| 9 | `soilCarbonMrvService.ts` | Revenue implied registry-grade credit value | Non-verified carbon revenue figure |
| 10 | `inputSupplierService.ts` | Empty `catch` silently returned demo dealers as live registry | Counterfeit-batch exposure risk |
| 11 | Stale `@deprecated` headers | 11 services claimed "not wired to any API surface" while actively wired | Misleads maintainers/auditors |

---

## Completed (this round)

### A. Shared provenance contract — `services/provenance.ts` (new)
- `pillarProvenance(kind, note, assumptions, demoData)` emits a `{ kind, assumptions, demoData, note }` block.
- Kinds: `computed_from_supplied_inputs` | `deterministic_estimation` | `demo_reference_data` | `unavailable`.
- Attached to every pillar response so consumers (and future UI badges) can render honesty signals.

### B. De-fabrication, per service
1. **ROI** — default yields **removed**; both yields now **required** (else `400` via thrown error with actionable message). `executiveSummary` replaced by `provenance` disclosure of fixed input budgets.
2. **EUDR** — **fails closed**: missing canopy evidence → `auditConclusion: 'assessment_unavailable'`, `isDeforestationFree: null`, `provenance.kind: 'unavailable'`. A compliance claim is only possible with caller-supplied measurements.
3. **Passport** — keeps demo GTIN but now must be surfaced via `provenance` (`demo_reference_data`, `demoData: true`, explicit `DEMO` assumption strings).
4. **IVR** — no configured voice path → `dispatchedCount: 0`, `provider: 'not_configured'`, provenance `unavailable` with remediation note. No more phantom success.
5. **Pest radar** — fabricated counties removed; `predictedImpactCounties` now derives **only** from `cluster.counties` (populated from actual sighting counties during clustering); actions rewritten as generic guidance without `[DEMO]` or fake claims.
6. **Trade** — static price snapshot + fixed freight/border constants disclosed in `provenance` (`demo_reference_data`).
7. **Offtake** — fixed yields/prices/window and the 3-buyer demo directory disclosed (`demo_reference_data` for buyer directory).
8. **Mechanization** — `findAvailableEquipment` now returns `{ equipment, provenance }` (demo flagged); mission plan carries its fixed-coefficient assumptions.
9. **Credit/insurance** — provenance notes "not a credit-bureau product" + lists fixed weights and illustrative ceilings.
10. **Carbon MRV** — "indicative only, not a registry credit" note; fixed factors listed.
11. **Suppliers** — silent demo fallback removed: `findNearbySuppliersLive` returns `{ dealers, provenance }` where demo fallback is flagged; live DB results flagged as such with inventory caveat.
12. **NDVI & IoT** — provenance with derived assumptions (e.g., "baseline assumed 0.62 when not supplied").

### C. Route adaptations (`routes/pillars.ts`)
- `/mechanization/search` → unwraps `.equipment` (API shape unchanged; provenance visible if the service is called directly or via future envelope).
- `/suppliers/nearby` → now returns `{ dealers, provenance }` (shape change; consumers must read `data.dealers`).

### D. Stale headers & logs corrected
- All 11 services: `@deprecated Specification phase only` → accurate "wired via POST /api/pillars/..." headers describing real data behavior.
- `paymentService.ts`: "payments will be simulated (Demo Mode)" → "payments unavailable (PAYMENT_GATEWAY_NOT_CONFIGURED)".
- `app.ts`: `nasaConfigured = true` now commented as intentional (NASA POWER is keyless), not a bug.

### E. Tests updated + new regression tests
- `frontierCapabilities.test.ts`: EUDR fail-closed case (new); passport provenance assertions; swarm counties `[]` + provenance kind; equipment provenance.
- `advancedPillars.test.ts`: IVR `dispatchedCount === 0` + `not_configured` + provenance; ROI throws on missing yields; ROI provenance assumptions.
- **Result: 36/36 pillar tests pass.**

---

## Remaining (tracked, not started)

### F1. Frontend provenance rendering — **DONE (this round)**
- `frontend/src/components/ProvenanceBadge.tsx` (new): kind→color chip (green/amber/orange/red) with `data-testid="provenance-badge"`.
- Rendered in `FarmerChatPage.tsx` for the OUTBREAK RISK card; `fetchOutbreakRisk` now parses the provenance-wrapped `/pillars/hazard/evaluate` envelope (`{ hazards, provenance }`) and threads it to state (previously the envelope change would have silently degraded every live score to the no-hazard floor of 10).
- Test: `frontend/src/__tests__/ProvenanceBadge.test.tsx` (chip per kind, hidden when absent).
- When further pillar panels are added, badge is mandatory.

### F2. Channel-config wiring (from the parallel audit thread) — **P1**
- `smsService`/`whatsappService` read only `process.env`; UI-saved `tenant_channel_configs` rows are dead weight for those channels.
- Plan: resolve credentials per-send via a `channelCredentialResolver` (env → `tenant_channel_configs` → `systemConfigService`), cache with short TTL.
- Files: `services/smsService.ts`, `services/whatsappService.ts`, `services/telegramService.ts` (align pattern), `routes/channels.ts` (masking on read, no masked-value round-trip on save).

### F3. Crew AI fabricated fallbacks — **DONE (this round)**
- `agents/crew_main.py`: all six MCP tools (weather, market price, soil, diagnosis, subsidy, research) now return `[UNAVAILABLE] {tool}: {reason}` on MCP failure instead of invented specifics; happy paths no longer carry fabricated defaults either (`data.get(...) ?? '[UNAVAILABLE: …]'`).
- `agents/main.py`: `ReportService` placeholder section generator (`Seasonal norms suggest…`) removed — sections that cannot be generated from live data are now explicit `[UNAVAILABLE]` placeholders.
- `agents/tools/cloakbrowser/*`: `metrics_provenance: 'estimated'` added to `ContentCandidate`; velocity returns 0 when post dates are unknown (no 24h assumption) — see F4 note in the doc's F4 section.


### F4. CloakBrowser estimated metrics — **DONE (this round)**
- `agents/tools/cloakbrowser/*`: `metrics_provenance: 'estimated'` now set on every `ContentCandidate`; `scanner_base.identify_viral_velocity` returns 0 velocity when post dates are missing (no 24h assumption).

### F5. `satelliteNdviService` baseline semantics — **P2**
- `baselineNdvi = 0.62` default is now disclosed; next step is to make it **required** for anomaly detection and skip anomaly computation otherwise (mirrors ROI change).

### F6. Backend audit P0s from `backend_audit_report.md` still open — **P2**
- `agentOrchestrator.executeNext().catch(() => {})` swallow → at minimum `logger.warn` + dead-letter counter.
- `Math.random()` IDs in `bulkOperationsService`, `agentTelemetry` → `crypto.randomUUID()`.
- `huggingface.ts`/`nvidia.ts` healthCheck `catch { return this.isConfigured() }` → return `false` + log.
- `soilGridsService.isAvailable()` silent catch → log + classify.

### F7. Pillar UI panels + `PILLAR_SERVICES_DECISION.md` deletion — **P3**
- Once F1 ships, remove `docs/PILLAR_SERVICES_DECISION.md` (references the removed deprecation headers) and add a `docs/PILLAR_PROVENANCE.md` describing the contract.

---

## Verification (reproduce)

```bash
cd ag-extension-dashboard/src/backend
npx tsc --noEmit          # clean for all pillar files (pre-existing errors in fields/users/sms are out of scope)
npx jest __tests__/advancedPillars.test.ts __tests__/advancedPillarsExpanded.test.ts __tests__/frontierCapabilities.test.ts   # 36/36 pass
grep -rn "not wired to any API surface" src/services/   # expect: no matches
grep -rn "executiveSummary\|log_only\|\[DEMO\] " src/services/ | grep -v "test"   # expect: only intentional [DEMO] record labels in mechanization demo directory

cd ../agents && python3 -m py_compile crew_main.py main.py tools/cloakbrowser/*.py   # syntax check

cd ../frontend && npx vitest run src/__tests__/ProvenanceBadge.test.tsx       # badge tests pass
```

## API-shape changes (breaking, flag to consumers)

| Endpoint | Before | After |
|---|---|---|
| `POST /api/pillars/roi/calculate` | yields defaulted, `executiveSummary` | yields **required** (400 otherwise), `provenance` added |
| `POST /api/pillars/traceability/eudr-verify` | fail-open compliance | `assessment_unavailable` when evidence missing, `provenance` added |
| `POST /api/pillars/voice/broadcast` | `dispatchedCount: N` always | `dispatchedCount: 0` + `not_configured` when no voice path |
| `POST /api/pillars/suppliers/nearby` | bare array | `{ dealers, provenance }` |
| `POST /api/pillars/pest/forecast` | invented counties | counties only from sighting data; `provenance` added |
