---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Replaced Math.random() with crypto.randomInt() for OTP and crypto.randomUUID() for ID generation in bulkOperationsService and agentTelemetry

Fix OTP generation in verificationFraudService.ts to use crypto.randomInt() instead of Math.random()

## Inputs

- `Current OTP implementation at line 305`

## Expected Output

- `ag-extension-dashboard/src/backend/src/services/verificationFraudService.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/verificationFraudService.test.ts`

## Verification

npm run test:backend -- verificationFraudService

## Observability Impact

OTP generation logged with crypto-secure method
