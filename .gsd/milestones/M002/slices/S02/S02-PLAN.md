# S02: AI Agent Control Plane Wiring

**Goal:** Implement or properly stub AI agent execute/stop endpoints to eliminate 501 responses
**Demo:** POST /api/ai/execute and POST /api/ai/stop/:agentId return 200/202 with proper orchestration or 503 with actionable error

## Must-Haves

- routes/ai/agents.ts wires orchestrator or returns 503 with errorCode ACTIONABLE_ERROR; integration test verifies endpoint behavior

## Proof Level

- This slice proves: integration

## Integration Closure

Agent control endpoints functional or explicitly disabled with feature flag

## Verification

- Agent execution metrics logged

## Tasks

- [ ] **T01: Fix AI Agent Control Endpoints** `est:1h`
  Fix AI agent execute/stop endpoints to properly handle orchestrator errors and return 503 with actionable error instead of 501
  - Files: `ag-extension-dashboard/src/backend/src/routes/ai/agents.ts`, `ag-extension-dashboard/src/backend/src/__tests__/agents.test.ts`
  - Verify: npm run test:backend -- agents

## Files Likely Touched

- ag-extension-dashboard/src/backend/src/routes/ai/agents.ts
- ag-extension-dashboard/src/backend/src/__tests__/agents.test.ts
