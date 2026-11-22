# Pillar Services Decision Record

**Date:** 2026-09-02
**Status:** Accepted
**Decision:** Mark 14 "Architecture Pillar" services as specification-phase only; remove from README/ARCHITECTURE_PILLARS.md claims until wired.

## Services Affected

These services include specifications and prototype routes; their presence or wiring
does not establish production readiness. Prototype pillar routes are only available
when explicitly enabled in development/test and remain gated elsewhere.

1. `traceabilityPassportService` — EUDR/GS1 passports (hardcoded GTIN, fake compliance)
2. `pestSwarmRadarService` — DBSCAN clustering (greedy neighbor merge, hardcoded counties)
3. `crossBorderTradeService` — *Removed 2026-11-20.* Regional arbitrage built on 3 hardcoded markets.
4. `mechanizationFleetService` — registry-backed equipment search and admin registration. Both use the authenticated user's active tenant. Pre-existing unassigned records remain hidden until ownership is verified. Drone planning remains illustrative; the routes are still prototypes.
5. `satelliteNdviService` — NDVI analysis (pure math on caller-supplied pixels)
6. `agriCreditInsuranceService` — Parametric insurance (fake verification source string)
7. `inputSupplierService` — *Removed 2026-11-20.* Anti-counterfeit check against an invented 5-item registry, with invented dealers and phone numbers.
8. `harvestOfftakeService` — *Removed 2026-11-20.* Offtaker matchmaking against 3 invented buyers with invented phone numbers.
9. `iotTelemetryService` — LoRaWAN sensors (no hardware integration)
10. `weatherHazardDaemonService` — Hazard warning daemon (fake dispatch counts, never scheduled)
11. `soilCarbonMrvService` — IPCC Tier 2 MRV (textbook formula, no verification)
12. `agronomicRoiService` — BCR financial modeling (no real data)
13. `ivrBroadcastService` — IVR voice broadcasts (TwiML only, no telephony)
14. `voiceAudioService` — Whisper transcription (empty branch, hardcoded Swahili). *Superseded:* its transcription and synthesis routes are now on the production allowlist (`POST /voice/transcribe`, `/voice/transcribe-local`, `/voice/synthesize`); IVR broadcast remains a prototype.

Also removed on 2026-11-20: `multiTenantFederationService` and its `/pillars/tenant/*` routes, and the
`/pillars/trade/arbitrage`, `/pillars/offtake/*` and `/pillars/suppliers/*` routes. Nothing in the app called
them, and their sample buyers, dealers and phone numbers could be mistaken for real businesses. Rebuild them
only on top of a real registry or partner data.

## Removed 2026-11-21

The remaining prototype routes answered 501 in every deployment, so they were dead
surface: `/pillars/traceability/*`, `/pillars/credit/*`, `/pillars/mechanization/*`,
`/pillars/pest/*`, `/pillars/iot/*`, `/pillars/satellite/*`, `/pillars/soil/*`,
`/pillars/roi/*`, `/pillars/hazard/scan` and the IVR routes. Removed with them:
`traceabilityPassportService`, `agriCreditInsuranceService`, `mechanizationFleetService`,
`iotTelemetryService`, `satelliteNdviService`, `satelliteIngestService`,
`soilCarbonMrvService`, `agronomicRoiService`, `ivrBroadcastService` and the pest
trajectory forecast. The mechanization tables stay in the database, untouched.

Still served: `POST /pillars/hazard/evaluate` and the speech routes. The pest clustering
in `pestSwarmRadarService` now feeds the WorldMonitor pest layer from recorded pest
diagnoses. `PILLARS_SPEC_ROUTES_ENABLED` no longer exists.

## Action Items

- [x] Remove these services from README.md feature list (README marks them as prototypes)
- [x] Remove from ARCHITECTURE_PILLARS.md capability claims (each section now carries a status note, 2026-11-15)
- [ ] Add `@deprecated` JSDoc tags with "Specification phase only — not wired to any API surface"
- [ ] Update test files to import from a `__specs__/` folder or mark tests as specification tests
- [ ] Create GitHub issues for each service to track implementation priority

## Rationale

These services were developed as specifications and prototypes. Some have routes, but
still need real integrations, tenant controls, operational safeguards or independent
domain validation. Honest documentation is more valuable than aspirational claims.