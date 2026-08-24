# Walkthrough: Quality Audit Fixes (P0 Correctness & Security Defects)

Plan: `implementation_plan.md` (approved). Scope: P0/P1 defects from the independent code-quality audit.

## Changes

### Browser extension (`ag-extension-browser-ext`) — now compiles, builds, and ships its content script
- Repaired the dangling `@ag-extension/shared` symlink (npm mis-target for nested scoped `file:` deps) and added a self-healing `scripts/fix-shared-link.cjs` wired into `postinstall`.
- Extracted offline queue types to `shared/offlineTypes.ts`; sidepanel now imports `QueuedRequest` instead of referencing an undefined type.
- Fixed broken async decryption in `getOfflineAttachment` (`await` inside a non-async IndexedDB callback — the offline attachment path never worked).
- Replaced hardcoded-passphrase pseudo-encryption (`ag-extension-indexeddb-key` / `ag-extension-salt`) with a random per-install AES-GCM-256 key persisted in `browser.storage.local`.
- Replaced MV3-hostile `setInterval` connectivity polling with `chrome.alarms` (1-min period; new `alarms` permission).
- Strict-mode fixes: dropped bogus `| null` farmer union (4× TS18047), properly typed SpeechRecognition lookup (no `as any` chain), guarded optional `actionType`.
- Popup default endpoint aligned to `CONFIG.API_BASE_URL` (was a hardcoded stale URL).
- Renamed content script to WXT's `ag-toolbar.content/index.ts` convention so it is registered in the built manifest (it had silently never shipped); added explicit util imports.
- Upgraded `wxt` 0.20.27 → 0.21.4 (+ vite 7, plugin-react 5): 0.20's vite-node pipeline ignored plugin filters and tried to `fetch()` real files ("Failed to parse URL"), which is exactly why the content script could never build. 0.21 removes that pipeline.
- `tsconfig.json` `moduleResolution` → `bundler` (required by wxt 0.21 export maps).

### Backend (`src/backend`)
- **WhatsApp webhook signatures**: new `middleware/webhookSignature.ts` verifies Meta `X-Hub-Signature-256` (HMAC-SHA256 over raw body, timing-safe compare) and Twilio `X-Twilio-Signature` fallback; production refuses traffic (503) when no provider secret is configured; dev warns and allows. Wired into `POST /api/whatsapp/inbound`. Raw body captured via `express.json({ verify })` + `Request.rawBody` augmentation. `.env.example` documents `META_APP_SECRET`.
- **Removed fabricated AI diagnosis**: `omniRouteService.executeWithFailover` now throws when all candidates are exhausted instead of returning canned "fungal leaf spot" text as if it were a model answer. Callers already surface errors honestly.
- **CORS**: extracted to pure `utils/corsOrigin.ts`; localhost/127.0.0.1 origins are no longer accepted in production.

## Tests

- `__tests__/whatsapp.test.ts`: +7 cases — unsigned-dev allowed, valid/invalid/missing Meta signature, prod-no-secret → 503, valid/forged Twilio signature.
- `__tests__/omniRouteService.test.ts`: rewritten for rejection semantics + explicit "never fabricates an answer" assertion.
- `__tests__/corsOrigin.test.ts`: new — prod localhost block, allowlist, gpexts subdomains, wildcard, dev passthrough.

## Verification

| Check | Result |
|---|---|
| Backend `tsc --noEmit` | 0 errors |
| Backend `jest` full suite | 49 suites, **415/415 pass** |
| Backend eslint on changed files | clean |
| Extension `tsc --noEmit` | 13 errors → **0** |
| Extension `wxt build` | succeeds; `content_scripts` present in manifest; `alarms` permission present |
| Extension security script | pass |
| Shared package `tsc --noEmit` | 0 errors |
| Hardcoded key scan | none remaining |

## Notes / deferred

- A parallel session's commit `626f4dd0` absorbed part of the `app.ts` edits mid-flight; all functional changes are present and verified in the working tree.
- Deferred (separate phases, per plan §6): zod coverage for 33 route files, god-component decomposition, i18n fallback masks, extension auth/token bootstrap + `<all_urls>` narrowing (needs product decisions).
