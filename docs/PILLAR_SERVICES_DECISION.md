# Pillar Services Decision Record

**Date:** 2026-09-02
**Status:** Accepted
**Decision:** Mark 14 "Architecture Pillar" services as specification-phase only; remove from README/ARCHITECTURE_PILLARS.md claims until wired.

## Services Affected

The following services exist only in test files (`__tests__/advancedPillars*.test.ts`, `__tests__/frontierCapabilities.test.ts`) with no route, tool, worker, or app.ts wiring:

1. `traceabilityPassportService` — EUDR/GS1 passports (hardcoded GTIN, fake compliance)
2. `pestSwarmRadarService` — DBSCAN clustering (greedy neighbor merge, hardcoded counties)
3. `crossBorderTradeService` — Regional arbitrage (3 hardcoded markets, 650km all pairs)
4. `mechanizationFleetService` — Drone/tractor marketplace (2 hardcoded entries)
5. `satelliteNdviService` — NDVI analysis (pure math on caller-supplied pixels)
6. `agriCreditInsuranceService` — Parametric insurance (fake verification source string)
7. `inputSupplierService` — Anti-counterfeit (5-item fake regulator registry)
8. `harvestOfftakeService` — Offtaker matchmaking (3 fake buyers)
9. `iotTelemetryService` — LoRaWAN sensors (no hardware integration)
10. `weatherHazardDaemonService` — Hazard warning daemon (fake dispatch counts, never scheduled)
11. `soilCarbonMrvService` — IPCC Tier 2 MRV (textbook formula, no verification)
12. `agronomicRoiService` — BCR financial modeling (no real data)
13. `ivrBroadcastService` — IVR voice broadcasts (TwiML only, no telephony)
14. `voiceAudioService` — Whisper transcription (empty branch, hardcoded Swahili)

## Action Items

- [ ] Remove these services from README.md feature list
- [ ] Remove from ARCHITECTURE_PILLARS.md capability claims
- [ ] Add `@deprecated` JSDoc tags with "Specification phase only — not wired to any API surface"
- [ ] Update test files to import from a `__specs__/` folder or mark tests as specification tests
- [ ] Create GitHub issues for each service to track implementation priority

## Rationale

These services were developed as specification prototypes but never integrated into the production API surface. The prior stub-audit rounds removed fabricated data from *wired* paths; these services remain as dead code that inflates capability claims. Honest documentation is more valuable than aspirational feature lists.