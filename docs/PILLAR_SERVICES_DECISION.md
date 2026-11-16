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
3. `crossBorderTradeService` — Regional arbitrage (3 hardcoded markets, 650km all pairs)
4. `mechanizationFleetService` — registry-backed equipment search and admin registration. Both use the authenticated user's active tenant. Pre-existing unassigned records remain hidden until ownership is verified. Drone planning remains illustrative; the routes are still prototypes.
5. `satelliteNdviService` — NDVI analysis (pure math on caller-supplied pixels)
6. `agriCreditInsuranceService` — Parametric insurance (fake verification source string)
7. `inputSupplierService` — Anti-counterfeit (5-item fake regulator registry)
8. `harvestOfftakeService` — Offtaker matchmaking (3 fake buyers)
9. `iotTelemetryService` — LoRaWAN sensors (no hardware integration)
10. `weatherHazardDaemonService` — Hazard warning daemon (fake dispatch counts, never scheduled)
11. `soilCarbonMrvService` — IPCC Tier 2 MRV (textbook formula, no verification)
12. `agronomicRoiService` — BCR financial modeling (no real data)
13. `ivrBroadcastService` — IVR voice broadcasts (TwiML only, no telephony)
14. `voiceAudioService` — Whisper transcription (empty branch, hardcoded Swahili). *Superseded:* its transcription and synthesis routes are now on the production allowlist (`POST /voice/transcribe`, `/voice/transcribe-local`, `/voice/synthesize`); IVR broadcast remains a prototype.

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