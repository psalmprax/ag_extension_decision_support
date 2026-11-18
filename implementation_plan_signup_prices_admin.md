# Implementation Plan: Signup & Manager Assignment, USD Producer Prices, System Admin Gate

**Status:** Plan proposed — awaiting approval (CLAUDE.md phase gate).
**Scope:** three independent slices. Land them in the order below.
**Branch:** local `stage` (per CLAUDE.md).

| Slice | Risk | Size | Depends on |
|---|---|---|---|
| 1. Officer signup + region-based regional-manager assignment | medium | M | — |
| 2. FAOSTAT USD producer prices on the landing page | low | M | — |
| 3. System-admin flag gating admin creation | medium | M | Slice 1 (shared files) |

**Sequencing constraints (verified):**

- Slices 1 and 3 both edit `src/frontend/src/pages/Register.tsx` and `src/backend/src/utils/schemas.ts`. Slice 1 must land first so Slice 3 does not re-edit the same registrations.
- Slice 3 edits `src/backend/src/routes/users.ts`, which currently has **uncommitted changes from another session** (working tree at the time of writing). Slice 3 starts only after that work is committed, otherwise the diff will conflict.
- Chesterton's fence: `prisma/seed.ts`, `prisma/seed.cjs` and `prisma/seed-quality-data.sql` all seed the same regional-manager accounts. Any seed change touches all three.

---

## Slice 1 — Officer signup with region-based regional-manager assignment

### Problem (verified in code)

1. `Register.tsx` sends `phoneNumber`; `registerSchema` expects `phone`; zod strips unknown keys, so **the phone number is silently discarded** on every signup.
2. `Register.tsx` sends no `region` and no `country`, so `users.region` is always NULL for self-registered users — yet `region` is the key every officer/RM scope query uses.
3. `Register.tsx` offers `<option value="admin">`, but `routes/auth/register.ts` allows only `['extension_officer','farmer']` and returns 403. The option is dead and confusing.
4. `User.managerId` → self-relation `ManagerOfficers` exists (migration `20260829120000_demo_flag_and_hierarchy`), is indexed, and has **zero write paths** — `BACKEND_FOLLOWUP_ARTIFACTS.md` records exactly this. Self-registered officers therefore belong to no manager.

### Decision for this slice

The public signup remains open to `extension_officer` and `farmer`. The **officer** selects country + region and the server resolves their regional manager. Farmers get no `managerId` (they are enrolled by an officer/RM — item 3 of the product list), and their region is optional.

**Open question for the user:** if item 3 removes farmer self-registration, drop `farmer` from the role select and the schema enum in this slice. Assumed below: farmer self-signup stays.

### Backend

**`src/backend/src/utils/schemas.ts`** — `registerSchema`:
- narrow `role` to `z.enum(['extension_officer', 'farmer']).optional()` so validation, not the handler, is the single source of truth;
- accept `phoneNumber` as an alias for `phone` via `z.preprocess` (keep `phone` canonical in the DB);
- add `country: z.string().min(2).max(64).optional()`;
- keep `region: z.string().max(100).optional()`, and require it when `role === 'extension_officer'` with a `.superRefine`.

**New `src/backend/src/services/regionalManagerResolver.ts`**
```ts
export interface ManagerResolution {
  managerId: string | null;
  matchedBy: 'exact' | 'normalized' | 'none';
}
resolveRegionalManager(region: string | null, country: string | null): Promise<ManagerResolution>
```
- Query: `SELECT id, region FROM users WHERE role = 'regional_manager' AND COALESCE(is_active, true) = true AND COALESCE(is_demo, false) = false AND ($2::text IS NULL OR COALESCE(country, '') = '' OR country = $2)`.
- **Exclude `is_demo = true` managers** so a real officer is never bound to a seeded demo RM.
- Match order: case-insensitive exact on `region`; then a normalized contains-match in either direction (bridges `'Central Region (Lilongwe)'` ↔ `'Lilongwe'`, which is a real mismatch between `frontend/src/lib/countries.ts` and the seeded RMs); deterministic tie-break by `created_at ASC, id ASC`.
- Returns `managerId: null` when nothing matches — signup still succeeds.

**`src/backend/src/routes/auth/register.ts`**
- Destructure `country`; resolve `phone` from `phone ?? phoneNumber`.
- Call `resolveRegionalManager` only when `role === 'extension_officer'`.
- Extend the `INSERT INTO users (...)` column list with `manager_id` and `country`.
- Response `data.user` gains `country`, and `data` gains `managerAssigned: boolean` + `region`. Do **not** return the manager's email or name — that would leak a staff directory to an unauthenticated caller.
- Log a `logger.info` when `matchedBy === 'none'` so ops can see regions without an RM.

### Frontend

**`src/frontend/src/pages/Register.tsx`**
- Rename form field `phoneNumber` → `phone` (fixes the silent drop).
- Add a `country` `<select>` fed by `SUPPORTED_COUNTRIES` from `@/lib/countries`, and a dependent `region` `<select>` from the chosen country's `regions`; clear `region` when `country` changes.
- Remove `<option value="admin">`. Remaining roles: extension officer, farmer.
- Show the region block as required for extension officer, optional for farmer.
- After success, if `managerAssigned === false`, show a non-blocking notice: "No regional manager is assigned to your region yet — an administrator will link your account." Navigate as it does today.

**`ag-extension-shared/src/api/auth.ts`** — this is the canonical contract; `authService.register` is typed from `RegisterData = z.infer<typeof registerDataSchema>`, not from a local interface:
- add `country: z.string().nullable().optional()` to `registerDataSchema` and to `userSchema`;
- narrow `registerDataSchema.role` to `z.enum(['extension_officer', 'farmer']).optional()` — **do not** narrow `userRoleSchema`, which types the full `User` and is used for all four roles;
- `phone` already exists on both schemas. The defect is only that the form sends `phoneNumber`, so keep `phone` as the wire field and fix the form.

The backend `registerSchema` in `src/backend/src/utils/schemas.ts` is a **separate copy** (there is no vendored `shared-api/auth` on the backend), so both definitions must change in the same commit. Recorded as a DRY follow-up, not fixed here.

### Tests

- `src/backend/src/__tests__/regionalManagerResolver.test.ts` (new): exact match; normalized `'Central Region (Lilongwe)'` → `'Lilongwe'`; no match → `null`; demo manager excluded; inactive manager excluded; country mismatch excluded; deterministic tie-break.
- `src/backend/src/__tests__/auth.register.test.ts` (extend if present, else new): `phoneNumber` persists as `phone`; `phone` still works; `admin` → 403; officer with a matching RM gets `manager_id`; officer with no RM → 201 and `managerAssigned: false`; farmer → `manager_id` NULL.
- `src/frontend/src/__tests__/registerForm.test.tsx` (new): the role select has exactly two options; submitting sends `phone`, `country`, `region`; payload has no `phoneNumber` key. This test is the guard that a type check cannot provide: `formData` is passed as a variable, so TypeScript's excess-property check never fires on the stray `phoneNumber`.

### Verification

```bash
npm run typecheck:backend
cd ag-extension-dashboard/src/backend && npx jest regionalManagerResolver auth.register --runInBand
npm run typecheck:frontend
npm run test:frontend -- registerForm
```

### Risks

- **Region strings are not a shared vocabulary today.** The normalized match is a bridge, not a fix. Follow-up (not in this slice): one canonical region list consumed by `countries.ts`, the seeds and the resolver.
- Changing seeded RM regions (e.g. `'Lilongwe'` → `'Central Region (Lilongwe)'`) would alter RM scoping of demo farmers. Deliberately **not** done here.

---

## Slice 2 — Real FAOSTAT USD producer prices on the landing page

### Why FAOSTAT and not Trading Economics

Verified directly: Trading Economics' Markets commodity set covers soybeans, wheat, tea, cocoa, beef and cotton — **not maize, sorghum or dry beans**, which are the three crops on the card. Its quotes are exchange benchmarks in USD/bushel, not East/Southern African producer prices, and public display requires a distribution licence (guest keys are sample-only; the $199/mo tier is 500 requests/month). The Gravity Index catalog has no commodity-price provider at all.

FAOSTAT Producer Prices are already the primary source in `marketPriceService.ts`, already requested with `element: '5532'` (`USD/tonne`), and already map the exact crop codes the card needs: `0112` Maize (Corn), `0115` Sorghum, `01591` Beans (Dry). Licence is CC BY 4.0 (attribution only).

### Problem (verified)

- `mapFaostatPrices` / `buildFaostatPriceRow` convert the USD producer price into the local currency and **discard the year and the unit** — `MarketPrice` has no `period`, `usdPerTonne` or `yoyPct`.
- `fetchLatestPrices` probes only the current year and the previous year. FAOSTAT producer prices lag roughly 1–2 years, so for 2026 it will usually fall through to GIEWS/baseline.
- There is no public price route: `getLatestPrices()` is called only from the authenticated `routes/knowledge/search.ts`.

### Backend

**`src/backend/src/services/marketPriceService.ts`**
- Add optional fields to `MarketPrice`: `period?: string | null`, `usdPerTonne?: number | null`, `yoyPct?: number | null`. Optional keeps every existing consumer and test valid.
- Thread the row `year` through `mapFaostatPrices` → `buildFaostatPriceRow`, and compute `yoyPct` from the previous-year map that is already built.
- Widen the year probe in `fetchLatestPrices` to `current−1, −2, −3` (first non-empty wins) instead of `current, −1`.
- New `getLandingPrices(country?)`: FAOSTAT only, USD only, no FX conversion — `currency: 'USD'`, `exchangeRateSource: 'native'`, `dataStatus: 'live'` (FAOSTAT is authoritative), restricted to `['0112','01591','0115']`, cached under `market-prices:landing:v1:<country>` with the existing 6 h TTL. Returns `[]` rather than invented numbers when upstream is empty.

**New `src/backend/src/routes/publicMarketPrices.ts`**
- `GET /api/v1/public/market-prices?country=Kenya`, `optionalAuth` + the existing public rate limiter, no auth required.
- Validate `country` through the existing `faostatAreaCode` map; unknown → 400 (never a silent Kenya default for an explicitly requested country).
- Response: `{ success, data: { country, currency: 'USD', fetchedAt, attribution: 'FAOSTAT Producer Prices (CC BY 4.0)', prices: [{ crop, cropCode, usdPerTonne, usdPerKg, usdPerBag90kg, period, yoyPct, dataStatus }] } }`.
- Mount in the router index next to the other public routes.

### Frontend

**`src/frontend/src/pages/landing/sections/FarmerServices.tsx`** (the "Check Fair Market Prices" card, ~L196–265)
- Fetch once on mount with an `AbortController`; no new global store.
- Render USD: `$0.38/kg` and `$34.20/90kg bag` (from `usdPerTonne / 1000`, and `× 90` for the bag) using tabular figures.
- Replace the disclaimer block with: `Producer price · {period} · FAOSTAT`, `Annual national producer price — not a market spot price`, and a `USD` badge. Add a visible FAOSTAT attribution link (`target="_blank"`, `rel="noopener noreferrer"`) — the licence requires it.
- Trend becomes `+2.4% vs {period−1}` or is omitted when `yoyPct` is null.
- **On fetch failure or empty data, keep the current illustrative block verbatim** (including "Illustrative demo data" / "Not live prices"). Never relabel sample numbers as real.

### Tests

- `src/backend/src/__tests__/marketPriceLanding.test.ts` (new): USD values untouched by FX; the three crop codes only; year surfaced; `yoyPct` computed; upstream-empty → `[]`; unknown country → 400.
- `src/backend/src/__tests__/marketPriceCache.test.ts` (extend): landing cache key/TTL.
- `src/frontend/src/__tests__/landingMarketPrices.test.tsx` (new): renders USD + year + attribution on success; falls back to the illustrative block on error and **asserts no dollar sign appears** in the fallback.

### Verification

```bash
npm run typecheck:backend
cd ag-extension-dashboard/src/backend && npx jest marketPrice --runInBand
npm run test:frontend -- landingMarketPrices
npm run lint:frontend
```

### Risks

- Upstream latency: the existing lookup budget (`MARKET_PRICE_BUDGET_MS`, 5 s default) already guards this; the landing endpoint must return the cached/empty shape rather than block.
- Honesty: the card must never present an annual producer price as today's market price. That labelling is part of the acceptance criteria, not decoration.

---

## Slice 3 — System-admin flag gating admin creation

### Problem (verified)

- No `super_admin` / `root_admin` / `isSystemAdmin` anywhere in the repo.
- `role` is a plain `VARCHAR(50)` with no CHECK constraint, and there are **44** `authorize(['admin', …])` call sites, so adding a new role value would silently widen 44 gates.
- `POST /users` and `PUT /users/:id` are `authorize(['admin'])` — **any** admin can mint another admin today.

### Decision

Add a boolean `isSystemAdmin` on `users`. The first seeded administrator (`admin@agridemo.com`) is the System/Super Admin. Only that flag may create an `admin` or change a role to `admin`. Chosen over a new role value because "admin" is per-tenant (`tenantId`/`TenantMembership` exist) while the system admin is above tenants, and because a flag does not touch the 44 existing role gates.

### Database

- **`prisma/schema.prisma`** (`User`, L10–95): `isSystemAdmin Boolean @default(false) @map("is_system_admin")`.
- **New `prisma/migrations/20261118120000_add_system_admin/migration.sql`**:
  ```sql
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_system_admin" BOOLEAN NOT NULL DEFAULT false;
  UPDATE "users" SET "is_system_admin" = true
  WHERE "id" = (SELECT "id" FROM "users" WHERE "role" = 'admin'
                ORDER BY "created_at" ASC NULLS LAST, "id" ASC LIMIT 1);
  ```
  The backfill is idempotent and promotes exactly the oldest admin, which is the seeded System Administrator.
- **`src/backend/src/services/db/schema.ts`** (legacy bootstrap block, ~L91 where `manager_id` is added): the same `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` plus the same backfill, so both provisioning paths converge.
- **Seeds:** `prisma/seed.ts`, `prisma/seed.cjs`, `prisma/seed-quality-data.sql` all set `isSystemAdmin = true` for `admin@agridemo.com`.

### Backend

- **`src/backend/src/services/userQueryBuilder.ts`** — add `is_system_admin` to `buildUserColumns` and to `PROFILE_COLUMNS`, with `legacySchema ? 'false AS is_system_admin' : …` so pre-migration databases still read. Extend `UserProfileColumnsOptions` with `includeSystemAdmin`.
- **`src/backend/src/types/dtos/billing.ts`** — `UserPublicRow`/`UserPublicDTO` + `mapUserPublicRow` gain `isSystemAdmin`.
- **`src/backend/src/types.d.ts`** — `Request['user']` gains `isSystemAdmin?: boolean`.
- **`src/backend/src/middleware/authorize.ts`** — new `requireSystemAdmin` that reads `SELECT is_system_admin FROM users WHERE id = $1` at request time. Deliberately **not** taken from the JWT: a flag revoked in the database must not stay powerful for the token's lifetime. 403 on false/missing.
- **`src/backend/src/routes/users.ts`**
  - `POST /` (L617): `role === 'admin'` requires `requireSystemAdmin`; otherwise 403 with an explicit message.
  - `PUT /:id` (L653): promoting to `admin` requires the flag; editing a user whose `is_system_admin` is true requires the flag; demoting/deactivating the **last active** system admin is rejected with 400.
  - `DELETE /:id` (L699): same guards; the last system admin cannot be deactivated.
  - `isMissingColumnError` (L~297) gains `is_system_admin` so the legacy fallback fires.
  - `validateSensitiveUserUpdates` takes the actor `{ userId, isSystemAdmin }` instead of just `actingUserId`.
- **`src/backend/src/routes/auth/session.ts`** (`/auth/me`, L207) and the login response: expose `isSystemAdmin` so the UI can hide admin-only affordances. Never expose it as a role name.
- **`src/backend/src/utils/schemas.ts`**: already narrowed by Slice 1. No further change.

### Frontend

- **`src/frontend/src/components/users/types.ts`**: `DirectoryUser.isSystemAdmin?: boolean`; add `assignableRoles(actor)` that filters `admin` out unless `actor.isSystemAdmin`.
- **`src/frontend/src/components/users/UserAccessModal.tsx`**: use `assignableRoles`; render a "System admin" badge; disable role/status controls when the target is the system admin.
- **`src/frontend/src/pages/Register.tsx`**: no `admin` option (done in Slice 1).
- **`ag-extension-shared/src/api/auth.ts`**: add `isSystemAdmin: z.boolean().optional()` to `userSchema`, so `AuthResponse`, `MeResponse` and the frontend `User` type carry it from one definition.
- **Auth store** (`src/frontend/src/store/useAppStore.ts` declares its own `User` type): mirror the field. `Register.tsx` does `setUser(userData as User)`, so a field absent from that local type is silently dropped.

### Tests

- `src/backend/src/__tests__/users.systemAdmin.test.ts` (new):
  - plain admin `POST /users` with `role: 'admin'` → 403; system admin → 201;
  - plain admin promoting an officer to admin → 403; system admin → 200;
  - plain admin deactivating the system admin → 403;
  - demoting or deactivating the **last** system admin → 400;
  - `requireSystemAdmin` rejects a valid admin JWT whose DB flag is false (stale-token case);
  - legacy schema fallback still returns `isSystemAdmin: false`.
- `src/frontend/src/__tests__/userAccessRoles.test.tsx` (new): a non-system admin sees no `admin` option; a system admin does; the system-admin row's controls are disabled.

### Verification

```bash
npm run typecheck
cd ag-extension-dashboard/src/backend && npx jest systemAdmin users --runInBand
npm run test:frontend -- userAccessRoles
npm run check:explicit-any
npm run lint:backend
```

### Risks

- `routes/users.ts` is under concurrent edit (see sequencing). Rebase the guard onto whatever the other session lands.
- Backfill promotes the oldest admin. If production already has several admins, exactly one becomes the system admin — confirm that account before deploying.
- Every `authorize(['admin'])` gate keeps working unchanged; only the three user-management mutations gain the flag check. This is intentional scope control.

---

## Ship checklist (per slice)

1. `git switch stage` (already there).
2. Implement + tests together; no placeholders, no empty catch blocks, no `any`.
3. Run the verification block above for that slice only.
4. `git diff` self-review: no secrets, sanitised inputs, no debug logging.
5. Conventional commit; merge `stage` into local `master` after verification; push to `origin stage` only when asked.
