# Deploy Checklist — Pending Prisma Migrations & Post-Rollout Verification

**Applies to:** backend rollout that introduces `subscription_change_events` and `cancellation_feedback`.
**Audience:** whoever runs the stage or production deploy (see `docs/DEPLOY_WORKFLOW.md` for the pipeline itself).

Pending migrations at the time of writing:

| Migration | Creates | Depended on by |
|---|---|---|
| `20260915120000_add_subscription_change_events` | `subscription_change_events` | `paymentAnalyticsService.getRevenueMetrics()` expansion/contraction revenue |
| `20260920120000_add_cancellation_feedback` | `cancellation_feedback` | `POST /api/billing/cancel` (reason capture) and `paymentAnalyticsService.getChurnPrediction()` |

Both migrations only create new tables and indexes. They do not alter or drop existing columns, so they are safe to apply while the previous API version is still serving traffic.

---

## 1. Pre-flight (before touching the server)

- [ ] `git log -1 --oneline` on the deploy checkout shows the commit you intend to ship.
- [ ] Backend CI is green: `npm run typecheck`, `npm test`, `npm run build` (110 suites / 1,086 tests as of this checklist).
- [ ] A database backup exists and its restore has been verified at least once:
      `pg_dump --format=custom "$DATABASE_URL" > backup-$(date +%F-%H%M).dump`
- [ ] Note disk headroom — migrations and image builds both consume space: `df -h /`.
- [ ] Current migration state is captured for comparison afterwards:
      `npx prisma migrate status`

Expected pre-state: `20260915120000_add_subscription_change_events` and `20260920120000_add_cancellation_feedback` listed as **not yet applied**.

---

## 2. Apply the migrations

Run inside `ag-extension-dashboard/src/backend` on the target host, with the production `DATABASE_URL` in scope:

```bash
npx prisma migrate status          # confirm which migrations are pending
npx prisma migrate deploy          # applies pending migrations only, no prompts
npx prisma migrate status          # must report "Database schema is up to date!"
```

`migrate deploy` is the correct command for deployed environments. Never run `migrate dev` or `db push` there: they can reset or silently drift the schema.

If the run stops with `relation "cancellation_feedback" already exists` or `relation "subscription_change_events" already exists` (a previous partial run, or the table was created out of band):

```bash
# Confirm the table already matches the migration before baselining.
psql "$DATABASE_URL" -c '\d cancellation_feedback'
npx prisma migrate resolve --applied 20260920120000_add_cancellation_feedback
npx prisma migrate deploy
```

Do the same for `20260915120000_add_subscription_change_events` if it is the one that collides.

---

## 3. Verify the schema landed

```bash
psql "$DATABASE_URL" -c '\d cancellation_feedback'
psql "$DATABASE_URL" -c '\d subscription_change_events'
```

Check each of the following:

- [ ] `cancellation_feedback` has columns `id, subscription_id, user_id, reason, comment, created_at, updated_at`.
- [ ] `cancellation_feedback_subscription_id_key` is a **unique** index (one feedback row per subscription).
- [ ] Indexes `cancellation_feedback_created_at_idx` and `cancellation_feedback_reason_idx` exist.
- [ ] Foreign keys point at `subscriptions(id)` and `users(id)`.
- [ ] `subscription_change_events` has `from_price`, `to_price`, and `created_at` with an index on `created_at`.
- [ ] `SELECT count(*) FROM cancellation_feedback;` runs (0 rows is the expected initial value).

---

## 4. Roll out the application

Follow the project's container rules — orphan cleanup first, then build, then start:

```bash
docker compose down --remove-orphans
docker compose build backend
docker compose up -d --no-build
docker compose ps
```

- [ ] Only the intended services were rebuilt; unrelated containers (`db`, `redis`, `traefik`) came back up healthy.
- [ ] `docker compose logs --tail=100 backend` shows the migration-free startup line and no `PrismaClientInitializationError`.

---

## 5. Health checks (in this order)

```bash
# 1. Liveness — process is up at all
curl -fsS http://localhost:3000/health/live

# 2. Readiness — DB and cache are reachable (503 means "not ready", not "broken")
curl -fsS http://localhost:3000/health/ready

# 3. Full health — includes AI provider status and dependency detail
curl -fsS http://localhost:3000/api/health

# 4. Public URL through the proxy (what users actually hit)
node scripts/smoke-probe.cjs 60 https://<public-host>/api/health
```

Pass criteria:

- [ ] `/health/live` returns `{"status":"ok"}`.
- [ ] `/health/ready` returns HTTP 200 with `services.database === "connected"` and `services.cache === "connected"`.
- [ ] `/api/health` returns 200. An AI provider that is `unconfigured` or `degraded` is reported in the body — it is not a rollout failure, but it must be understood and written down.
- [ ] `scripts/smoke-probe.cjs` exits 0 (it polls every 3s until the deadline, so it is safe to run while the container is still warming).

---

## 6. Functional checks on the new code paths

Use a test account with an active subscription, not a real customer.

- [ ] **Reason capture:**
      `POST /api/billing/cancel` with `{"reason":"too_expensive","comment":"checklist smoke"}`
      returns 200 with `feedbackRecorded: true`.
- [ ] **Reason validation:**
      `POST /api/billing/cancel` with `{"reason":"because"}` returns 400 with `errorCode: "INVALID_CANCELLATION_REASON"` and does not call the payment gateway.
- [ ] **Persistence:**
      `psql "$DATABASE_URL" -c "SELECT reason, comment, created_at FROM cancellation_feedback ORDER BY created_at DESC LIMIT 5;"`
      shows the row you just wrote.
- [ ] **Re-cancel does not duplicate:** cancelling the same subscription again updates the row instead of inserting a second one.
      `SELECT count(*) FROM cancellation_feedback WHERE subscription_id = '<id>';` returns `1`.
- [ ] **Analytics:**
      `GET /api/v1/billing/analytics/churn` (admin token) returns `churnReasons` containing `too_expensive` and `churnReasonCoverage` with `recorded >= 1` and `cancellationsLast30Days >= recorded`.
- [ ] **Revenue metrics still work:** `GET /api/v1/billing/analytics/revenue?timeframe=month` returns 200 with numeric `expansionRevenue` and `contractionRevenue`.

---

## 7. Watch window (first 30 minutes)

- [ ] `docker compose logs -f backend` — no `Failed to record cancellation feedback`, no Prisma `P2021` (`table does not exist`).
- [ ] Error rate on `/api/v1/billing/*` is flat against the previous hour.
- [ ] `SELECT count(*) FROM payment_events WHERE created_at > now() - interval '30 minutes';` is in line with normal traffic (whatever table your event log uses — the point is that billing traffic is still flowing).
- [ ] Disk usage has not jumped unexpectedly: `df -h /`.

---

## 8. Rollback

The application rollback and the schema rollback are separate decisions.

**Application only** (recommended first step — the old code ignores the new tables):

```bash
git checkout <previous-release-sha>
docker compose down --remove-orphans
docker compose build backend
docker compose up -d --no-build
```

**Schema rollback** (only if the tables themselves are the problem — this deletes any captured feedback):

```sql
BEGIN;
DROP TABLE IF EXISTS cancellation_feedback;
DROP TABLE IF EXISTS subscription_change_events;
COMMIT;
```

Then mark the migrations as rolled back so the next deploy does not skip them:

```bash
npx prisma migrate resolve --rolled-back 20260920120000_add_cancellation_feedback
npx prisma migrate resolve --rolled-back 20260915120000_add_subscription_change_events
```

- [ ] After any rollback, re-run section 5 and record the results.

---

## 9. Sign-off

| Check | Owner | Result | Notes |
|---|---|---|---|
| Backup verified | | | |
| `migrate deploy` clean | | | |
| Schema inspection | | | |
| Readiness 200 | | | |
| `/api/health` reviewed | | | |
| Cancel-with-reason smoke | | | |
| Churn endpoint smoke | | | |
| 30-minute watch | | | |
