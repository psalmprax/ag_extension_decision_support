# Implementation Plan: Real-World Seed (2 Regional Managers + Farmers) and Real-Backend Playwright E2E

**Status:** Plan proposed — awaiting approval.
**Goal:** a non-demo dataset that behaves like real usage, plus an end-to-end suite that runs against the real backend and database so it can expose integration gaps the mocked suite cannot.

---

## Executive summary

The existing seeds are demo fixtures: `prisma/seed.ts` writes `admin@agridemo.com`, `demo@agridemo.com`, four `isDemo: true` regional managers and 12 Kenyan farmers that are mirrored 1:1 with the frontend `DEMO_FARMERS` array (enforced by tests). Those stay untouched — changing them would desynchronise the demo experience.

This plan adds a **separate** real-world seed with its own users, its own reserved domain, and known passwords, plus a **third** Playwright config that starts the backend and frontend together. Today's `playwright.config.ts` starts only Vite and every existing spec mocks `/api` with `page.route`, so the current suite can never reveal a backend, database, RLS or auth-linkage gap.

---

## Part 1 — Real-world seed

### Credentials (all accounts, ready to log in)

Passwords are generated as a bcrypt hash at seed time (never copy-pasted), and every account is created `email_verified = true`, `is_active = true`, `is_demo = false`, so login works with no verification step — including when `REQUIRE_EMAIL_VERIFICATION=true`.

**Shared password for every seeded real-world account: `Harvest2026!`**
It satisfies the live policy (≥10 chars, letter + digit, not in the common-password list).

| Role | Username (email) | Country | Region | Manager |
|---|---|---|---|---|
| Regional manager | `rm.nakuru@real.agriext.test` | Kenya | `Rift Valley` | — |
| Regional manager | `rm.mzuzu@real.agriext.test` | Malawi | `Northern Region (Mzuzu)` | — |
| Extension officer | `officer.nakuru@real.agriext.test` | Kenya | `Rift Valley` | RM Nakuru |
| Extension officer | `officer.mzuzu@real.agriext.test` | Malawi | `Northern Region (Mzuzu)` | RM Mzuzu |
| Farmer ×6 | `farmer.nakuru.01..06@real.agriext.test` | Kenya | `Rift Valley` | RM Nakuru (via officer) |
| Farmer ×6 | `farmer.mzuzu.01..06@real.agriext.test` | Malawi | `Northern Region (Mzuzu)` | RM Mzuzu (via officer) |

- `.test` is an RFC 2606 reserved TLD: a stray verification mail can never reach a real inbox.
- **Region strings are canonical**: they are exactly the values in `src/frontend/src/lib/countries.ts`, so the new `regionalManagerResolver` matches them exactly, and the signup flow in Part 2 can assign a manager without the normalisation fallback.
- The seeded managers are **not** `is_demo`, so the resolver's demo exclusion does not skip them.

### Files

**New `prisma/realWorldSeed.ts`** — data only, mirroring the shape of `demoFarmers.ts`:

```ts
export const REAL_WORLD_PASSWORD = 'Harvest2026!';
export const REAL_WORLD_EMAIL_DOMAIN = '@real.agriext.test';
export interface RealWorldFarmer { id: string; userId: string; ... }
export const REAL_WORLD_REGIONS: RealWorldRegion[]; // 2 entries, 1 officer, 6 farmers each
```

Fixed UUIDs in unused ranges (`e1…` managers, `e2…` officers, `e3…` farmer users, `e4…` farmer records) so reruns converge.

**New `prisma/seed-realworld.ts`** — the executable:
1. `bcrypt.hash(REAL_WORLD_PASSWORD, 10)` once, reused for every account (matches the cost already used by the demo seeds).
2. Upsert managers → capture ids; upsert officers with `managerId` = manager id; upsert farmer users with `managerId` = manager id; upsert `farmers` rows with `userId` = farmer user id and `assignedOfficerId` = officer id.
3. Give each real-world user a **Free** subscription row (the login handler resolves a plan from `subscriptions`; without one the account still logs in but reports no plan).
4. `--reset` flag: deletes only rows whose email ends with `@real.agriext.test`, in FK-safe order (`farmers` → `visits`/`fields` → `users`). Never touches demo rows.
5. Prints the credentials table above, with the password, at the end of every run.
6. Exits non-zero with a clear message if `DATABASE_URL` is unset or the database is unreachable.

**Scripts**

- backend `package.json`: `"seed:realworld": "ts-node -r tsconfig-paths/register --transpile-only prisma/seed-realworld.ts"`.
- root `package.json`: `"seed:realworld": "cd ag-extension-dashboard/src/backend && npm run seed:realworld"`.

**Verified fact worth knowing now:** the hash in `seed-quality-data.sql` is confirmed to be `password123` (checked with `bcrypt.compareSync`), so today's demo accounts log in as `password123`. The real-world seed does **not** reuse that hash — it derives its own from `Harvest2026!`.

### Tests

`src/__tests__/realWorldSeed.test.ts` (pure, no DB — import `realWorldSeed.ts` only):
- every email ends with `@real.agriext.test` and is unique;
- every region string exists in `SUPPORTED_COUNTRIES`;
- exactly 2 managers, each with ≥5 and ≤7 farmers;
- `REAL_WORLD_PASSWORD` passes `passwordProblems(password)` with no problems;
- ids are UUIDs and unique across all collections;
- no id or email collides with `DEMO_SEED_FARMERS` or the demo accounts.

### Verification

```bash
npm run seed:realworld
# login proof, one per role (must all be 200)
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3001/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"rm.nakuru@real.agriext.test","password":"Harvest2026!"}'
# ...repeat for officer.nakuru, farmer.nakuru.01, rm.mzuzu, officer.mzuzu, farmer.mzuzu.01
```

The seed itself also asserts the linkage before exiting: 6 farmers per manager, every officer's `manager_id` set, every farmer's `assigned_officer_id` set.

---

## Part 2 — Real-backend Playwright E2E

### Why a third config is required

- `playwright.config.ts` → `testDir: './tests'`, `webServer` runs **only** `npm run dev` (Vite). Existing specs (`demo-mode`, `release-gates`, …) intercept `/api` with `page.route`, so nothing reaches a server.
- `vite.config.ts` proxies `/api` to `http://backend:3001` — the **docker-compose service name**, which does not resolve from a test host.
- `playwright.live.config.ts` → `testDir: './tests-live'` runs against an already-deployed URL; it cannot seed or reset data.

So neither existing config can exercise a freshly seeded local database.

### Files

**`vite.config.ts`** (one-line, backwards-compatible):
```ts
target: process.env.VITE_API_PROXY_TARGET ?? 'http://backend:3001',
```

**New `playwright.e2e.config.ts`**
- `testDir: './tests-e2e'`, `fullyParallel: false`, `workers: 1`, `retries: 0`.
- `globalSetup: './tests-e2e/global-setup.ts'`: runs `prisma migrate deploy`, then the real-world seed, then fails fast if `/api/v1/health` is not ready.
- `webServer: [ { command: backend dev, url: http://127.0.0.1:3001/api/v1/health }, { command: 'VITE_API_PROXY_TARGET=http://127.0.0.1:3001 npm run dev -- --host 127.0.0.1', url: http://127.0.0.1:5173 } ]`.
- `projects: [chromium]`, `trace: 'on-first-retry'`, `video: 'off'`.

**`tests-e2e/helpers/auth.ts`** — `loginAs(page, email, password)` filling the real Login form and waiting for the dashboard shell; `signOut(page)`; `uniqueEmail(prefix)` = `e2e-<runId>-<prefix>@real.agriext.test`.

**Specs**

1. `realworld-login.spec.ts` — every seeded account in the credentials table logs in through the UI. Asserts: URL after login, the account's name/region rendered, no console errors, no failed `/api` response. This is the direct proof that "these users have usernames and passwords that log in properly".
2. `manager-scoping.spec.ts` — RM Nakuru lists exactly the 6 Kenyan farmers and never a Mzuzu name; RM Mzuzu the inverse. Runs as a data assertion against the rendered list plus the JSON response body, so a leak is caught either way.
3. `officer-signup-assignment.spec.ts` — signs up a new officer from `/register` with country `Kenya`, region `Rift Valley`; the response reports `managerAssigned: true`; then RM Nakuru's officer list contains the new account. This exercises Slice 1 against the real resolver.
4. `unassigned-region.spec.ts` — signs up an officer in a country with no seeded manager; the UI shows the "no regional manager covers …" notice and an admin sees the account unlinked (rather than the officer silently landing in limbo).
5. `market-prices.spec.ts` — landing card renders USD figures with a visible `FAOSTAT` attribution and a published year, **or** the labelled sample block if upstream is down; never a dollar figure labelled as sample data.
6. `farmer-registration.spec.ts` — **expected to fail today, kept as the tripwire**: an officer calling `POST /api/v1/farmers` directly currently has no role gate, so the test records the missing authorisation instead of asserting it away. It flips green when item 3 is implemented.

### Data hygiene

- The seed is read-only during tests: specs create rows only with the `e2e-<runId>` prefix and delete them in `afterAll` (or `--reset` before the run).
- No test may mutate a seeded farmer, manager or password; scoping tests read only.

### CI

New job `e2e-real` (not part of the default `npm test`): Postgres service → `prisma migrate deploy` → `npm run seed:realworld` → `npx playwright test --config playwright.e2e.config.ts` → upload `test-results/` on failure. Kept separate from the mocked e2e job so a flaky live DB never blocks unit CI.

### Gaps this suite is expected to expose (honest expectations)

- **No in-product way to link an officer to a manager** — only signup resolves it; an unassigned officer needs SQL. (Admin assignment UI is follow-up work.)
- **`POST /farmers` is not role-gated** — any authenticated user can create a farmer in any region today.
- **`/auth/me` does not return `country`** — the shared `userSchema` now allows it, but `buildUserProfileColumns` does not select it, so a client cannot rebuild the signup context after a reload.
- **Role scoping on list endpoints** — the scoping spec is the first test that proves it rather than assumes it.
- **Demo/real isolation** — a real account must never see `is_demo` rows outside its manager scope.

---

## Sequencing and risk

1. Seed + credential verification first (Part 1) — it is independently useful and unblocks manual QA immediately.
2. Then `VITE_API_PROXY_TARGET`, the config, and specs 1–3.
3. Then specs 4–6.

Risks: the backend `dev` server compiles with `ts-node-dev --transpile-only` (no type errors block startup, so a broken import appears only as a 500 — the health gate catches it); the shared Postgres must not be production; and `--reset` must be scoped by email domain, never by role, or it would delete demo accounts.
