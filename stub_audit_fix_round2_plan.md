# Stub Audit Remediation — Round 2

## Scope

Seven source-backed issues from the second audit. No new external dependencies. All changes are contract/behavioral corrections within existing files.

## 1. Payment service: return errors instead of mock success

**Files:** `ag-extension-dashboard/src/backend/src/services/paymentService.ts`

Change four methods to return `PAYMENT_GATEWAY_NOT_CONFIGURED` errors instead of mock success when Stripe/PayPal are absent:

- `cancelSubscription()` — return `false` with error logged
- `switchSubscription()` — return `{ success: false, errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED' }`
- `deletePaymentMethod()` — return `{ success: false, errorCode: 'PAYMENT_GATEWAY_NOT_CONFIGURED' }`
- `executePayPalPayment()` — return `false` with error logged

No billing route changes needed — the routes already handle `success: false` from these methods.

## 2. AI agent execute/stop: return not-configured

**Files:** `ag-extension-dashboard/src/backend/src/routes/ai.ts`

- `/execute`: After validating agent ID, attempt a real health-check to the agent's URL. If unreachable, return `not_configured` with a clear message. If reachable, return `running` only with a dispatched task.
- `/stop/:agentId`: Same — return `not_configured` if unreachable.

## 3. Telegram webhook: use real weather/market services

**Files:** `ag-extension-dashboard/src/backend/src/routes/channels.ts`

- Replace the hardcoded weather string with a `WeatherService.getByLocation()` call. On failure, return an explicit unavailable message.
- Replace the hardcoded price string with a `marketPriceService.getLatestPrices()` call. On failure, return an explicit unavailable message.

## 4. Agent Zero: remove fabricated metrics from AI analysis

**Files:** `ag-extension-dashboard/src/agents/main.py`

In `_parse_analysis_response()`:
- Remove `total_farmers: 150`
- Remove `avg_yield: "3.2 tons/ha"`
- Remove `weather_impact: "positive"`
- Remove `confidence: 0.85`
- Replace `data_sources` claim with `["ai_interpretation"]` to reflect it came from the LLM, not from actual data queries.

In `ReportService._get_fallback_section_content()`:
- Prefix each section with `[UNAVAILABLE]` so consumers can distinguish generated text from live data.
- Change report `status` to `"generated_without_live_data"` when fallback sections are used.

## 5. Agricultural report: fix commodity/crop filter bug

**Files:** `ag-extension-dashboard/src/backend/src/services/agriculturalReportService.ts`

- Change `p.commodity` to `p.crop` in the price filter.
- Guard `parseFloat` of coordinates and skip satellite query when lat/lng are zero.
- Add explicit data-status metadata to the report payload.

## 6. Commercial knowledge: add provenance labeling

**Files:** `ag-extension-dashboard/src/backend/src/routes/commercialKnowledge.ts`

- Add `corpusStatus: 'seed_only'` and `corpusSize: 3` to response metadata so API consumers know this is a minimal seed corpus, not a live knowledge API.

## 7. Frontend context-menu: replace static fallback with unavailable state

**Files:** `ag-extension-dashboard/src/frontend/src/api/contextMenuService.ts`

- Replace `getStaticFallbackMenu()` with a function that returns an unavailable state (single section with "Menu unavailable — refresh to retry").
**Files:** `ag-extension-dashboard/src/frontend/src/hooks/useAppMenuActions.ts`

- Add a `notify` when the user tries an action that isn't wired up, so it surfaces as a visible toast rather than a silent no-op.

## Verification

After implementation:
- Backend: `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --runInBand`
- Frontend: `npm run lint`, `npm run typecheck`, `npm test`
- `git diff --check`
- Source scan for remaining mock/stub markers in production paths