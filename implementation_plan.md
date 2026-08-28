# P0–P3 Production Truthfulness and Completeness Remediation Plan

## Goal
Remove misleading, fabricated, simulated, placeholder, and incomplete behavior from production frontend/backend paths; preserve explicitly labeled demo/simulator features; repair confirmed API contract defects; and improve maintainability without introducing new dependencies.

## Constraints
- Work only on the local `stage` branch.
- Preserve intentional demo/simulator content, but isolate it visually and semantically from live workflows.
- No fabricated fallback values in production paths.
- Use explicit `unavailable`, `estimated`, `queued`, `pending`, `sent`, `completed`, and `failed` states.
- Do not add dependencies unless an existing dependency cannot satisfy the requirement.
- Use existing shared API contracts and project conventions.
- Add or update tests alongside implementation.
- Do not commit, push, deploy, or alter infrastructure.

## Batch 1 — P0: Operational correctness and false-success prevention

### Frontend
- `ag-extension-dashboard/src/frontend/src/pages/ReportsPage.tsx`
  - Remove fabricated report viewer fallback text and hardcoded executive metrics.
  - Render API-backed values only; show explicit unavailable states.
  - Correct PDF download to use `/reporting/:id/download/pdf`.
  - Add download error handling and revoke object URLs.
  - Add explicit export format behavior.
- `ag-extension-dashboard/src/frontend/src/api/reportService.ts`
  - Separate CSV/PDF download methods with typed return contracts.
- `ag-extension-dashboard/src/frontend/src/components/LiveActivityStream.tsx`
  - Inspect response success before showing SMS success.
  - Show unavailable/error state when backend returns `{ success: false }`.
- `ag-extension-browser-ext/entrypoints/sidepanel/components/VisitLogger.tsx`
  - Separate persisted success from offline queued state.
  - Ensure button/status text says `Queued for sync` rather than `Logged` for HTTP 202.
- `ag-extension-dashboard/src/frontend/src/components/forms/VisitSynthesisForm.tsx`
  - Mark field presets as sample text.
  - Track preset usage and require explicit confirmation before saving sample-derived content to a farmer record.

### Backend
- `ag-extension-dashboard/src/backend/src/services/smsService.ts`
  - Correct USSD choice routing.
  - Remove generic fake disease diagnosis wording; return explicit unavailable state or real bounded diagnosis integration.
  - Validate phone formats and remove unsafe Kenya fallback behavior where no tenant geography exists.
- `ag-extension-dashboard/src/backend/src/routes/reporting.ts`
  - Validate supported report types.
  - Do not mark empty/unsupported reports as completed.
  - Enforce tenant scope consistently for report data queries.
  - Remove redundant Excel workbook write.
- `ag-extension-dashboard/src/backend/src/routes/whatsapp.ts`
  - Capture outbound reply result and persist/log failed delivery.
  - Do not imply successful handling when reply dispatch failed.
- `ag-extension-dashboard/src/backend/src/routes/analytics.ts`
  - Distinguish database failure from valid empty analytics.
  - Return explicit unavailable/error metadata rather than successful zero values.

## Batch 2 — P1: Provenance, live/demo separation, and geographic correctness

- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAI.tsx`
  - Remove synthetic citations from free-form responses.
  - Replace unsupported live telemetry badges with API-derived or unavailable states.
  - Mark preset output as demo preview data throughout the result message.
  - Keep unavailable image/PDF/SMS controls explicit; disable or route to real workflows.
  - Replace fake voice-input affordance with a disabled/unavailable control or connect it to the existing recorder flow.
- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAgentOps.tsx`
  - Separate demo fleet cards from live agent status.
  - Disable execute/stop controls when backend returns not-wired responses.
  - Remove static “healthy/live” console claims or label them as demo logs.
  - Use live API data where available and show unknown/unavailable otherwise.
- `ag-extension-dashboard/src/frontend/src/components/ReportsPage.tsx`
  - Derive summary metrics from API data or show unavailable values.
  - Remove hardcoded NDVI and security hash claims.
- `ag-extension-dashboard/src/backend/src/routes/channels.ts`
  - Replace placeholder provider identities with null/not-configured values.
  - Avoid hardcoded Kenya/East Africa weather for unknown users; resolve linked location or return unavailable.
  - Rename Telegram echo response from conversational AI fallback unless real AI is invoked.
- `ag-extension-dashboard/src/backend/src/services/marketPriceService.ts`
  - Return unavailable for unknown geography rather than defaulting to another country.
  - Preserve visible estimated/live provenance across all consumers.
- `ag-extension-dashboard/src/backend/src/services/plantDiseaseService.ts`
  - Replace `any` payloads with typed input contracts.
  - Mark heuristic/internal knowledge matches as estimates rather than verified field evidence.
  - Validate provider response shape before normalization.

## Batch 3 — P2: Complete or remove dangling features

- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAI.tsx`
  - Wire image analysis, voice STT, PDF export, and advisory SMS to existing APIs where contracts support it; otherwise remove controls from this view and link users to working pages.
- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAgentOps.tsx`
  - Connect control actions to the actual orchestrator where supported, or make controls visibly disabled with a configuration explanation.
- `ag-extension-dashboard/src/frontend/src/components/LiveActivityStream.tsx`
  - Persist claim/release actions through backend endpoints, or relabel them as local-only preview actions and disable production use.
  - Disable unimplemented WebRTC microphone/camera buttons.
- `ag-extension-dashboard/src/frontend/src/components/ContextMenu.tsx`
- `ag-extension-dashboard/src/frontend/src/api/contextMenuService.ts`
- `ag-extension-dashboard/src/backend/src/routes/contextMenus.ts`
  - Keep templates explicitly unavailable until storage/configuration exists, and remove or gate controls that imply templates are usable.
- `ag-extension-dashboard/src/frontend/src/components/campaigns/GoalModeCampaignModal.tsx`
  - Verify queued/completed campaign response semantics and correct success messaging.
- `ag-extension-dashboard/src/frontend/src/components/forms/VisitModal.tsx`
  - Use persisted scheduling result semantics and remove demo wording from production success paths.

## Batch 4 — P3: Maintainability, typing, and verification coverage

- Extract shared report download/notification helpers and typed API response contracts.
- Extract AlphaAI message construction/routing and AlphaAgentOps live/demo state handling into focused modules under existing feature directories.
- Extract SMS state/loading/send logic into hooks or focused service helpers while preserving public components.
- Replace touched `any` usage with typed DTOs and runtime validation using existing Zod dependency.
- Add regression tests for:
  - report PDF vs CSV downloads
  - fabricated report fallback removal
  - analytics unavailable state
  - USSD menu routing
  - SMS `{ success: false }` handling
  - WhatsApp outbound delivery failure
  - queued vs persisted VisitLogger state
  - sample preset save confirmation
  - placeholder channel configuration
  - unknown geography handling
  - demo/live AlphaAI and AgentOps labeling
- Add or update browser-level tests for report export and unavailable operational controls where test infrastructure permits.

## Verification plan

After each batch:
- `npm run lint:backend`
- `npm run lint:frontend`
- relevant backend Jest tests
- relevant frontend Vitest tests
- backend/frontend typechecks or builds

Final:
- `npm run lint`
- `npm run build:backend`
- `npm run build:frontend`
- `npm test`
- `npm run fallow:audit`
- `npm run fallow:check`
- `git diff --check`
- source scan for fabricated success, placeholder provider values, unsupported live claims, and stale mock comments
- review frontend accessibility, sanitization, error states, and object URL cleanup

## Expected residuals

Intentional simulator/demo UI may continue to contain deterministic sample data and animation, but it must remain visibly labeled and must not write fabricated operational records or report live success. Existing inherited Fallow complexity/duplication may remain if not introduced by this work; all new regressions must be eliminated or justified.
