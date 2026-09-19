---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Fix AI Agent Control Endpoints

Fix AI agent execute/stop endpoints to properly handle orchestrator errors and return 503 with actionable error instead of 501

## Inputs

- `Current 501 fallback at lines 130-139`
- `Silent catch at line 111`

## Expected Output

- `ag-extension-dashboard/src/backend/src/routes/ai/agents.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/agents.test.ts`

## Verification

npm run test:backend -- agents

## Observability Impact

Agent execution errors properly logged with context
