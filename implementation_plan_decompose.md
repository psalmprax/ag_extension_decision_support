# Implementation Plan — Decompose Oversize Files (no behavior change)

Goal: bring all files >300 lines (per CLAUDE.md) down via pure code moves. No logic, route, or API changes. Each wave is independently shippable.

Constraints:
- Work on local `stage` branch only. No commit/push/deploy without explicit request.
- Strict moves: identical handlers, paths, middleware order, exports. Extract helpers/components as-is.
- Preserve import stability: `import xRoutes from './routes/x'` must keep working via `routes/x/index.ts` barrel re-exporting a single merged `Router`.
- Backend `strict: true` + `tsc --noEmit` clean; frontend `tsc --noEmit` clean; both `eslint` clean (frontend ≤20 warnings, currently 1).
- Existing `implementation_plan.md` (P0–P3 truthfulness) is untouched; this plan lives in `implementation_plan_decompose.md`.

## Wave 1 — Backend routes (highest ROI, lowest risk)

### 1. `src/backend/src/routes/auth.ts` (877) → `src/backend/src/routes/auth/`
- CREATE `auth/login.ts`: `POST /login` (line 73), `POST /refresh` (413), `POST /logout` (444) + `JWTPayload` interface (45).
- CREATE `auth/register.ts`: `POST /register` (260), `POST /demo` (346), `createFreeSubscription` helper (18).
- CREATE `auth/mfa.ts`: `POST /mfa/verify` (568), `POST /mfa/setup` (683), `POST /mfa/enable` (708), `POST /mfa/disable` (753).
- CREATE `auth/sessions.ts`: `GET /me` (449), `GET /login-history` (500), `GET /login-stats` (538), `GET /sessions` (804), `DELETE /sessions/:id` (829), `POST /sessions/revoke-others` (855).
- CREATE `auth/index.ts`: `Router().use(login, register, mfa, sessions)`, `export default router`.
- DELETE `routes/auth.ts` (git mv). Verify `app.ts:27` import resolves.
- MODIFY none besides moves.

### 2. `src/backend/src/routes/billing.ts` (1035) → `src/backend/src/routes/billing/`
- CREATE `billing/subscription.ts`: `GET /plans` (44), `GET /subscription` (61), `GET /usage` (88), `POST /subscribe` (175), `POST /cancel` (231), `POST /portal` (264), `POST /switch` (304). Keep `idempotencyMiddleware` (18) in `index.ts`.
- CREATE `billing/paymentMethods.ts`: `GET|POST /payment-methods` (368, 409), `DELETE /payment-methods/:id` (443), `GET /invoices` (465).
- CREATE `billing/analytics.ts`: `GET /analytics/*` (513–616), `PATCH /admin/config` (633).
- CREATE `billing/paypal.ts`: `POST /paypal/subscribe` (678), `GET /paypal/success` (730), `GET /paypal/cancel` (798).
- CREATE `billing/voucher.ts`: `POST /voucher/redeem` (813), `POST /voucher/generate` (841), `GET /voucher/list` (864).
- CREATE `billing/transactions.ts`: `POST /transaction/submit` (889), `GET /transaction/my` (930), `GET /transaction/list` (947), `POST /transaction/verify/:id` (967), `POST /transaction/reject/:id` (991).
- CREATE `billing/webhook.ts`: `POST /webhook` (1020, raw-body middleware stays on this sub-router only).
- CREATE `billing/index.ts`: mount all sub-routers in original order. DELETE `routes/billing.ts`.

### 3. `src/backend/src/routes/knowledge.ts` (1276) → `src/backend/src/routes/knowledge/`
- CREATE `knowledge/search.ts`: `GET /search` (474), `GET /search/external` (587), `GET /live-context` (709), `POST /ask` (844), `GET /graph/:entity` (1265).
- CREATE `knowledge/articles.ts`: `GET /` quota-adjacent? No — `GET /history` (556), `GET /stats` (576), `GET /:id` (748), `POST /` (983), `PUT /:id` (1086), `POST /reorder` (932). Keep `authorize` + `createShareRoute('knowledge')` (929) in `index.ts`.
- CREATE `knowledge/meta.ts`: `GET /meta/categories` (620), `GET /meta/crops` (639), `GET /offline-pack` (520), `GET /quota` (37).
- CREATE `knowledge/ingest.ts`: `POST /ingest` (1233, multer stays here), `POST /ragv2/bootstrap` (1243), `POST /synthesize-visit` (772).
- CREATE `knowledge/index.ts`: barrel. DELETE `routes/knowledge.ts`.

### 4. `src/backend/src/routes/farmers.ts` (924) → `src/backend/src/routes/farmers/`
- CREATE `farmers/crud.ts`: `GET /` (82), `GET /:id` (202), `POST /` (295), `PATCH /:id` (376), `GET /my-officer` (865). Keep `authorize` (30) + `createShareRoute('farmer')` (503) in index.
- CREATE `farmers/bulk.ts`: `POST /reorder` (553), `POST /bulk/delete` (646), `POST /bulk/update` (711).
- CREATE `farmers/importExport.ts`: `GET /export` (776), `POST /import` (819).
- CREATE `farmers/index.ts`: barrel. DELETE `routes/farmers.ts`.

### 5. `src/backend/src/routes/reporting.ts` (856) → `src/backend/src/routes/reporting/`
- CREATE `reporting/crud.ts`: `GET /` (102), `GET /:id` (261).
- CREATE `reporting/generate.ts`: `POST /generate` (240, `checkUsageLimit('report')` stays here).
- CREATE `reporting/downloads.ts`: `GET /:id/download` (297), `GET /:id/download/pdf` (744), `GET /:id/download/excel` (786). Keep `createShareRoute('report')` (854) in index.
- CREATE `reporting/index.ts`: barrel. DELETE `routes/reporting.ts`.

### 6. `src/backend/src/routes/chatbot.ts` (750) → `src/backend/src/routes/chatbot/`
- CREATE `chatbot/conversations.ts`: `GET /conversations` (49), `GET /conversations/:id/messages` (136), `POST /conversations` (246), `DELETE /conversations/:id` (295), `POST /conversations/:id/rate` (468), `POST /conversations/:id/read` (700).
- CREATE `chatbot/messages.ts`: shared `handleMessagePost` + `POST /message` (462), `POST /messages` (463), `PATCH /messages/:id` (661), `DELETE /messages/:id` (683).
- CREATE `chatbot/completions.ts`: `POST /completions` (598), `GET /stats/overview` (716).
- CREATE `chatbot/index.ts`: barrel. DELETE `routes/chatbot.ts`.

## Wave 2 — Backend services/types (only if Wave 1 green)

- `services/knowledgeService.ts` (1063, single-export smell — only `getKnowledgeEvidenceStatus` at line 18 is top-level export; rest is class/static): split into `services/knowledge/{evidence.ts, client.ts, index.ts}` only after reading full file. Deferred detail to execution; no API change.
- `services/paymentService.ts` (850, `PaymentService` class + `export const paymentService` at 850): split into `services/payment/{stripe.ts, paypal.ts, voucher.ts, index.ts}` preserving singleton export path. Deferred detail.
- `services/databaseService.ts` (848): split into `services/db/{pool.ts, migrate.ts, query.ts, index.ts}` preserving `query`, `withTransaction`, `getPool`, `initializeDatabase`, `closeDatabase` names (lines 10, 176, 746, 753, 809, 823, 842).
- `types/dtos.ts` (758): split by domain into `types/dtos/{farmer.ts, visit.ts, knowledge.ts, chat.ts, billing.ts, index.ts}`; `index.ts` re-exports all so existing `import ... from '@/types/dtos'` keeps working. Interfaces to move: `FarmerDetailDTO` (141), `VisitStatsDTO` (204), `KnowledgeArticleDTO` (256), `ChatMessageDTO` (611), etc.
- `app.ts` (497): extract `app/createApp.ts` (express setup + middleware chain lines 1–26) from route-mounting section (27–64+); `app.ts` becomes 20-line bootstrap. Optional, last.

## Wave 3 — Frontend (only if Waves 1–2 green)

- `pages/LandingPage.tsx` (2202) → `pages/landing/`: CREATE `data.ts` (`SANDBOX_PRESETS` 171), `variants.ts` (animation variants 53), `sections/{Hero.tsx (499), Problem.tsx (971), Features.tsx (1022), AgentOS.tsx (1225), HowItWorks.tsx (1466), Demo.tsx (1523), ROI.tsx (1711), FAQ.tsx (1760, incl `toggleFaq` 280), Mission.tsx (1846), CTA.tsx (1884)}. `LandingPage.tsx` (232) keeps `handleRunSimulation` (244) + composition only, ~120 lines.
- `components/KnowledgeBase/index.tsx` (1339) → `components/KnowledgeBase/`: CREATE `catalog.ts` (`DOCUMENT_CATALOG` 101), `scenarios.ts` (`RESEARCH_SCENARIOS` 217), `QuotaChip.tsx` (398), `AIResult.tsx` exists (845 lines — leave alone this round). `index.tsx` keeps `KnowledgeBase` (418) composition only.
- `pages/SMS.tsx` (960): MOVE already-exported `ContactListItem` (48), `SMSComposerComposeTab` (84), `SMSComposerHistoryTab` (235), `SMSComposerPanel` (288), `SMSContactsPanel` (449), `SMSRightPanel` (593) each to own file under `pages/sms/`; keep helpers `getQuotaPercent` (560), `QuotaSummary` (565), `MessageStats` (580), `TemplateList` (589) in `pages/sms/widgets.tsx`; `SMSPage` (659) stays as composition.
- `components/Cyber/AlphaAI.tsx` (904): CREATE `alpha/{rules.ts (46–64), offlineQueue.ts (84–96), response.ts (101–147), badges.tsx (416, 424), MessageStream.tsx (441), StudioTabs.tsx (234–273)}. `AlphaAI.tsx` keeps `AlphaAI` (501) composition only. Extract `useAlphaChat.ts` hook only if state logic exceeds 100 lines during execution.

## Verification plan (per wave, stop on red)
1. `cd src/backend && npx tsc --noEmit` → exit 0 (baseline: clean).
2. `cd src/frontend && npx tsc --noEmit` → exit 0 (baseline: clean).
3. `cd src/backend && npm run lint` → exit 0; `cd src/frontend && npm run lint` → 0 errors.
4. Route-table snapshot: `rg -h "router\.(get|post|put|patch|delete)" src/backend/src/routes | sort > /tmp/routes.before` pre-wave, diff post-wave must be empty (order-insensitive).
5. `cd src/backend && npx jest src/__tests__/errorHandler.test.ts src/__tests__/security.gateAndAuth.test.ts` → 40/40 (smoke); then full `npm run test:backend` before ship.
6. `cd src/frontend && npm run test` (vitest) before ship.
7. No file >300 lines remains in touched areas except explicitly deferred (`AIResult.tsx`).

## Open questions (need your call)
1. Scope: Wave 1 only first, or authorize all three waves in sequence?
2. Barrel style: `routes/x/index.ts` (proposed, zero import churn) vs updating `app.ts` imports to named sub-routers?
3. `types/dtos.ts` re-export barrel acceptable, or update all consumers to deep imports now?
4. Defer `AIResult.tsx` (845) and `Liquid.tsx` (1103) this round, or include?
