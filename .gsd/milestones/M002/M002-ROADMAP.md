# M002: P0 Production Blockers Resolution

**Vision:** Resolve all P0 agricultural/human safety hazards and production-blocking issues identified in the backend audit and anti-flaws compliance review. This milestone addresses cryptographic security, AI provider wiring, worker enablement, and data integrity foundations required for safe production deployment with real farmers.

## Success Criteria

- All P0 findings from backend_audit_report.md resolved
- crypto.randomInt() used for OTP generation
- crypto.randomUUID() used for all ID generation
- AI agent endpoints return 200/202/503 (never 501)
- BaseAIProvider has safe defaults or true abstracts
- Advisory/ingestion workers enabled by default with feature flags
- All estimated responses carry dataStatus metadata
- npm run security:test passes
- npm run test:backend passes (346+ tests)
- npm run fallow:check delta ≤ 0

## Slices

- [ ] **S01: Cryptographic Security Hardening** `risk:medium` `depends:[]`
  > After this: OTP generation uses crypto.randomInt(), bulk/telemetry IDs use crypto.randomUUID(), all security tests pass

- [ ] **S02: AI Agent Control Plane Wiring** `risk:medium` `depends:[]`
  > After this: POST /api/ai/execute and POST /api/ai/stop/:agentId return 200/202 with proper orchestration or 503 with actionable error

- [ ] **S03: BaseAIProvider Implementation Completeness** `risk:medium` `depends:[]`
  > After this: All AI provider implementations (OpenAI, Groq, Azure, Vertex, Anthropic, Ollama, etc.) compile and pass health checks

- [ ] **S04: Advisory & Ingestion Workers Enablement** `risk:medium` `depends:[]`
  > After this: ADVISORY_ENGINE_ENABLED and INGESTION_ENABLED feature flags default to true in development; workers start and log activity

- [ ] **S05: Data Status Transparency for Estimated Responses** `risk:medium` `depends:[]`
  > After this: weatherService.ts, marketPriceService.ts, openMeteoSoilService.ts, satelliteService.ts all return dataStatus: 'estimated'|'modeled'|'mock' with confidence/staleness metadata

## Boundary Map

Not provided.
