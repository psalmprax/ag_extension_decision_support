# Backend follow-up artifacts for new stage commits

This document captures the highest-value backend follow-ups for the `stage` commit batch relative to `origin/master`.

It is a working artifact, not a final certification. It should be updated as the code is verified.

---

## 1) Subscription ownership contract

### Where to look
- `src/services/paymentService.ts` — Stripe webhook handling and `getPricingPlans()`
- `src/routes/billing/subscription.ts` — route-level subscription mutations
- `src/routes/billing/paypal.ts` — PayPal subscribe/success path
- `src/services/transactionService.ts` — `activateSubmission()`

### Contract

```text
Subscription state ownership

1. Stripe-driven subscription state is authoritative from the Stripe webhook handler
   in paymentService.handleWebhook().

   Webhook owns:
     - status
     - currentPeriodStart / currentPeriodEnd
     - cancelAtPeriodEnd
     - linkage to stripeSubscriptionId

   Route-level subscription writes in routes/billing/subscription.ts are mirrors or
   complementary local writes only. They must not contradict the webhook's understanding
   of the same subscription row.

2. PayPal subscription state is created/updated only in routes/billing/paypal.ts
   success handler. There is no PayPal webhook equivalent in this codebase, so that
   handler is the single PayPal subscription writer.

3. Payment records must be created by the same path that finalizes the subscription
   for that provider, so there is no orphan payment and no duplicate subscription claim.

4. Local subscription lookups commonly use userId, but Stripe-side truth is identified
   by stripeSubscriptionId. When both are present, webhook reconciliation by
   stripeSubscriptionId is preferred for Stripe-driven fields.
```

### Concrete risk points
- `subscription.ts` `/switch` and `/subscribe` must not write Stripe-owned fields that the webhook owns.
- `handleWebhook()` must not assume route-side state is authoritative for Stripe-driven fields.
- `paypal/success` must remain the only PayPal subscription writer.
- `activateSubmission()` should treat `verifiedBy` and `providerReceipt` as local mutation data, not as a separate subscription owner.
- If `Subscription` local mirror can exist per `userId` while Stripe truth is per `stripeSubscriptionId`, both keys matter.

---

## 2) User/tenant field coverage map

### Findings

| Field / model | Write path(s) | Read path(s) | Optional handled? | Tenant scoped? | Notes |
|---|---|---|---|---|---|
| `User.country` | `routes/users.ts` create/update (write/query), `auth/register` create, pool seed, migration default `Kenya` | `routes/users.ts` read, `types/rowTypes`, `types/dtos/billing`, analytics tenant clause on users table | yes | partial — analytics scoping exists on `users.tenant_id` | Active mutation coverage confirmed; tenant link exists on schema but is not a fully enforced ORM filter layer yet |
| `User.isDemo` | `auth/register`, pool, migrations, seed | `auth/login`, `auth/session`, `usageService`, analytics `is_demo` filters, `officerGamificationService`, `usdaMarketService` fallback path | yes | partial | Active coverage confirmed; parity with `Farmer.isDemo` appears acceptable |
| `User.managerId` | schema/relation only in Prisma and migration | not yet found in mutation paths | yes | n/a | FK scaffolding present; direct writes not confirmed yet |
| `User.emailVerified` | `auth/register`, `auth/passwordReset`, migrations | `auth/login` gate, `auth/passwordReset` | yes | n/a | Active coverage confirmed |
| `User.emailVerificationToken/Expires` | `auth/passwordReset`, migrations | `auth/passwordReset` verify + expiry | yes | n/a | Active coverage confirmed |
| `User.lastTotpStep` | `auth/mfa` update, migrations | `auth/mfa` step comparison | yes | n/a | Active coverage confirmed |
| `User.mfaSecret/BackupCodes` | `auth/mfa`, `services/mfaService`, `account.ts` erase/redaction, migrations | `auth/mfa`, `account.ts` SENSITIVE_COLUMNS redaction | yes | n/a | Active coverage confirmed |
| `User.failedLoginAttempts/lockoutUntil` | `lockoutService`, `auth/login`, `auth/passwordReset`, migrations | `auth/login`, `auth/mfa` lockout check | yes | n/a | Active coverage confirmed |
| `User.lastLoginAt/loginHistories/sessions` | `loginHistoryService`, `sessionService`, `auth/login`, migrations | `auth/session` login history, `auth/sessions` session listing, `account.ts` | yes | n/a | Active coverage confirmed |
| `AuditLog` | `middleware/auditMiddleware` → `audit_logs` | not yet confirmed as a first-class admin/audit read path | yes | partial | Write path active; dedicated read UI not confirmed yet |
| `PendingPaypalPayment` | `routes/billing/paypal` subscribe/success + cleanup sweep | `routes/billing/paypal` success lookup | yes | ? | Active coverage confirmed |
| `OfflineQueueItem` | not yet found as live mutation path | not yet found as live read path | yes | ? | Schema/prisma present; confirm retry/deletion path or mark deferred |
| `LoginHistory` | `loginHistoryService`, migrations | `auth/session`, `frontend/src/api/authService`, `frontend/UserManagementPage` | yes | ? | Active coverage confirmed |
| `UserSession` | `sessionService`, migrations | `sessionService` validation, `routes/auth/sessions`, `routes/account`, `middleware/authorize`, tests | yes | n/a | Active coverage confirmed |
| `SupportTicket` | schema/prisma/migrations present | not yet confirmed as live create/read path | yes | ? | Confirm create/read or mark deferred |
| `WhatsappMessage` | schema/prisma/migrations present | not yet confirmed as live create/read path | yes | ? | Confirm create/read or mark deferred |
| `SmsFeedback` | schema/prisma/migrations present, `routes/sms` insert found | not yet confirmed as full read path | yes | yes | Insert path found; confirm read path or mark deferred |
| `Farmer.isDemo` | pool, migrations, seed | not yet confirmed as broad read path | yes | ? | Confirm demo parity with user side |
| `Visit.tenant` | `routes/visits`, migrations | `routes/visits` tenant filtering | yes | yes | Active tenant filtering confirmed |
| `ChatConversation.tenant` | migrations, schema | not yet confirmed as broad read path | yes | yes | FK + index present; confirm filtering or mark deferred |
| `Report.tenant` | `routes/reporting/generate`, `routes/reporting/crud`, `routes/reporting/downloads`, migrations | reporting routes tenant filtering | yes | yes | Active tenant filtering confirmed |
| `Alert.tenant` | `routes/alerts`, `tools/registerAlertTool`, migrations | `routes/alerts` tenant filtering | yes | yes | Active tenant filtering confirmed |
| `Notification.tenant` | migrations, schema | not yet confirmed as broad read path | yes | yes | FK + index present; confirm filtering or mark deferred |
| `Share.createdBy` | schema/prisma present | not yet confirmed as ownership read path | yes | ? | Confirm ownership read or mark deferred |
| `DataExportRequest.tenant/requester` | `routes/dataRights`, migrations | `routes/dataRights` insert | yes | yes | Active insert path confirmed |
| `SupportTicket.tenant/creator/assignee` | schema/prisma/migrations present | not yet confirmed as live create/read path | yes | yes | Confirm create/read or mark deferred |
| `WhatsappMessage.tenant/farmer` | schema/prisma/migrations present | not yet confirmed as live create/read path | yes | yes | Confirm create/read or mark deferred |
| `SmsFeedback.tenant/farmer` | schema/prisma/migrations present, `routes/sms` insert found | not yet confirmed as full read path | yes | yes | Insert path found; confirm read path or mark deferred |

### Suggested verification approach
1. Search user create/update paths for writes to `country`, `isDemo`, `managerId`, email verification token/expiry, MFA fields.
2. Search auth/login/MFA/password reset/revoke paths for reads/writes to `mfa_enabled`, `email_verified`, `lockout_until`, `failed_login_attempts`, `mfa_secret`, `mfa_backup_codes`, `last_totp_step`.
3. Search session create/refresh/revoke paths for reads/writes to `UserSession` and session validation.
4. Search tenant-filtered queries to confirm whether tenant links are used yet or intentionally deferred.
5. For anything still unanswered, either wire it, document it as deferred, or remove it if speculative.

---

## 3) Billing endpoint parity and role scoping table

### Old billing endpoints that should still exist
From old `billing.ts`:

- `GET /plans`
- `GET /subscription`
- `GET /usage`
- `POST /subscribe`
- `POST /cancel`
- `POST /portal`
- `POST /switch`
- `GET /payment-methods`
- `POST /payment-methods`
- `DELETE /payment-methods/:id`
- `GET /invoices`
- `GET /analytics/dashboard`
- `GET /analytics/revenue`
- `GET /analytics/customers`
- `GET /analytics/subscriptions`
- `GET /analytics/payment-methods`
- `GET /analytics/churn`
- `GET /analytics/cohorts`
- `PATCH /admin/config`
- `POST /paypal/subscribe`
- `GET /paypal/success`
- `GET /paypal/cancel`
- `POST /voucher/redeem`
- `POST /voucher/generate`
- `GET /voucher/list`
- `POST /transaction/submit`
- `GET /transaction/my`
- `GET /transaction/list`
- `POST /transaction/verify/:id`
- `POST /transaction/reject/:id`
- `POST /webhook`

### New billing additions
- `GET /mpesa/availability`
- `POST /mpesa/stk-push`
- `GET /mpesa/status/:checkoutRequestId`
- `POST /mpesa/callback/:secret`

### Parity table

| Method | Path | Old module | New module | Roles | Status | Notes |
|---|---|---|---|---|---|---|
| GET | /plans | billing | subscription | public? | preserved | confirm auth intent |
| GET | /subscription | billing | subscription | admin,extension_officer,farmer | preserved | |
| GET | /usage | billing | subscription | admin,extension_officer,farmer | preserved | |
| POST | /subscribe | billing | subscription | admin,extension_officer,farmer | preserved | |
| POST | /cancel | billing | subscription | admin,extension_officer,farmer | preserved | |
| POST | /portal | billing | subscription | admin,extension_officer,farmer | preserved | |
| POST | /switch | billing | subscription | admin,extension_officer,farmer | preserved | |
| GET | /payment-methods | billing | paymentMethods | admin,extension_officer,farmer | preserved | |
| POST | /payment-methods | billing | paymentMethods | admin,extension_officer,farmer | preserved | |
| DELETE | /payment-methods/:id | billing | paymentMethods | admin,extension_officer,farmer | preserved | |
| GET | /invoices | billing | paymentMethods | admin,extension_officer,farmer | preserved | |
| GET | /analytics/dashboard | billing | analytics | admin | preserved | |
| GET | /analytics/revenue | billing | analytics | admin | preserved | |
| GET | /analytics/customers | billing | analytics | admin | preserved | |
| GET | /analytics/subscriptions | billing | analytics | admin | preserved | |
| GET | /analytics/payment-methods | billing | analytics | admin | preserved | |
| GET | /analytics/churn | billing | analytics | admin | preserved | |
| GET | /analytics/cohorts | billing | analytics | admin | preserved | |
| PATCH | /admin/config | billing | analytics | admin | preserved | |
| POST | /paypal/subscribe | billing | paypal | admin,extension_officer,farmer | preserved | |
| GET | /paypal/success | billing | paypal | admin,extension_officer,farmer | preserved | |
| GET | /paypal/cancel | billing | paypal | admin,extension_officer,farmer | preserved | |
| POST | /voucher/redeem | billing | voucher | admin,extension_officer,farmer | preserved | |
| POST | /voucher/generate | billing | voucher | admin | preserved | |
| GET | /voucher/list | billing | voucher | admin | preserved | |
| POST | /transaction/submit | billing | transactions | admin,extension_officer,farmer | preserved | |
| GET | /transaction/my | billing | transactions | admin,extension_officer,farmer | preserved | |
| GET | /transaction/list | billing | transactions | admin | preserved | |
| POST | /transaction/verify/:id | billing | transactions | admin | preserved | |
| POST | /transaction/reject/:id | billing | transactions | admin | preserved | |
| POST | /webhook | billing | webhook | public? | preserved | signature protection only |
| POST/GET/POST/POST | /mpesa/* | n/a | mpesa | admin,extension_officer,farmer + public callback | new | callback is public but secret-protected |

### Scoping checks
- Confirm `GET /plans` is intentionally public or intentionally auth-gated.
- Confirm `POST /webhook` is not auth-gated in a way Stripe cannot satisfy.
- Confirm M-Pesa callback is public but protected by `MPESA_CALLBACK_SECRET`.
- Confirm no admin-only route became broadly accessible.
- Confirm idempotency is still applied once at the billing router level in `index.ts`.

---

## 4) Other backend follow-ups

### Audit middleware
- Current behavior: writes `audit_logs` with redaction and body caps.
- Current redaction keys: `password`, `newpassword`, `currentpassword`, `token`, `refreshtoken`, `secret`, `otp`, `code`, `apikey`, `authorization`, `card`, `cvv` (`middleware/auditMiddleware.ts`).
- Follow-up: confirm redaction key list covers credentials/tokens/card-like payloads on all audited paths.
- Follow-up: confirm audit writes are not a bottleneck under normal load.

### Trust proxy
- Current behavior: `TRUST_PROXY_HOPS` parsed in `app.ts`, default `1`.
- Env example and compose both use `TRUST_PROXY_HOPS=1` by default.
- Follow-up: confirm deployment topology matches the default or set the env explicitly.

### Unconfigured Stripe behavior
- Current behavior: `getPricingPlans()` returns `[]` and logs a warning when Stripe is absent.
- Follow-up: confirm local/dev/demo/test expectations and decide whether an explicit fallback is needed.

### Session revocation
- Current behavior: DB-backed sessions with shared-state and in-process caching (`sessionService.ts`).
- Follow-up: confirm cross-instance revocation behavior matches intended guarantees.

---

## 5) Suggested order

1. Finalize subscription ownership contract in code comments.
2. Fill the user/tenant field coverage map.
3. Finalize the billing endpoint parity and role scoping table.
4. Document audit redaction scope and trust-proxy assumption.
5. Verify unconfigured Stripe behavior against local/dev/demo/test expectations.
6. Confirm session revocation behavior if cross-instance correctness matters.

---

## 6) Status of the current diff

Currently changed files for the subscription ownership follow-up:
- `src/services/paymentService.ts`
- `src/routes/billing/subscription.ts`
- `src/routes/billing/paypal.ts`

These contain:
- subscription ownership contract
- PayPal ownership note
- unconfigured Stripe note
- route-level ownership notes

Remaining follow-ups are documented above but not yet implemented as code changes.
