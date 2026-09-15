# S01: Cryptographic Security Hardening

**Goal:** Replace all Math.random() usage with cryptographically secure alternatives for OTP generation, ID generation, and telemetry
**Demo:** OTP generation uses crypto.randomInt(), bulk/telemetry IDs use crypto.randomUUID(), all security tests pass

## Must-Haves

- verificationFraudService.ts:305 uses crypto.randomInt(100000, 999999); bulkOperationsService.ts:48 and agentTelemetry.ts:144 use crypto.randomUUID(); npm run security:test passes

## Proof Level

- This slice proves: unit+integration

## Integration Closure

No Math.random() in security-sensitive paths; CI security audit green

## Verification

- Security audit logs show crypto-secure method

## Tasks

- [x] **T01: Replaced Math.random() with crypto.randomInt() for OTP and crypto.randomUUID() for ID generation in bulkOperationsService and agentTelemetry** `est:30m`
  Fix OTP generation in verificationFraudService.ts to use crypto.randomInt() instead of Math.random()
  - Files: `ag-extension-dashboard/src/backend/src/services/verificationFraudService.ts`, `ag-extension-dashboard/src/backend/src/__tests__/verificationFraudService.test.ts`
  - Verify: npm run test:backend -- verificationFraudService

## Files Likely Touched

- ag-extension-dashboard/src/backend/src/services/verificationFraudService.ts
- ag-extension-dashboard/src/backend/src/__tests__/verificationFraudService.test.ts
