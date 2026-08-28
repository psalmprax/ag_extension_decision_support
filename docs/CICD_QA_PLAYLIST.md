# CI/CD Q&A Playlist

This playlist is the operational companion for the Ag-Extension Decision Support Dashboard CI/CD system. It is written as a question-and-answer sequence for developers, reviewers, release managers, and operators.

Use it during onboarding, pull-request review, staging releases, production releases, and incident response.

## How to use this playlist

- Read Sections 1–4 before changing a workflow.
- Read Sections 5–8 before merging or releasing.
- Use Sections 9–12 when a pipeline or deployment fails.
- Treat every command and gate as a repository contract; do not replace it with an assumed equivalent.
- Never place secrets, tokens, database passwords, or provider credentials in workflow files, logs, commits, or screenshots.

---

## 1. Pipeline orientation

### Q1. What does this repository deploy?

**A.** The main deployable system is the agricultural extension dashboard, consisting of:

- An Express/TypeScript backend.
- A React/Vite frontend and PWA assets.
- PostgreSQL with Prisma and pgvector support.
- Redis for cache, queues, and Socket.IO infrastructure.
- Background workers for email, alerts, and ingestion.
- Optional agent services and a browser extension.

The repository also contains mobile and browser-extension packaging workflows. A change should be validated against every artifact it can affect, not only the dashboard bundle.

### Q2. Which CI/CD workflows exist?

**A.** The root README identifies these GitHub Actions workflows:

- `.github/workflows/ci-cd.yml` — general CI/CD pipeline.
- `.github/workflows/security-audit.yml` — security and dependency checks.
- `.github/workflows/deploy-stage.yml` — staging deployment.
- `.github/workflows/deploy-all.yml` — broader deployment orchestration.
- `.github/workflows/mobile-release.yml` — mobile release automation.

Always inspect the workflow file before changing assumptions about triggers, environments, permissions, or required checks.

### Q3. What is the normal lifecycle for a code change?

**A.** The project lifecycle is:

1. Define the requirement and affected systems.
2. Plan the exact files and verification steps.
3. Obtain approval when the change is non-trivial.
4. Implement tests alongside production code.
5. Run lint, typechecks, builds, and tests.
6. Review the diff for security, accessibility, and truthfulness.
7. Validate release readiness.
8. Merge and deploy through the approved branch/workflow path.

### Q4. Which branch is used for local implementation?

**A.** Local implementation is performed on `stage`. The repository instructions require local merging from `stage` into local `master` only after verification. Remote synchronization is restricted to the remote `stage` branch. Do not push directly to remote `master`.

### Q5. What should a pull request prove?

**A.** It should prove:

- The requested behavior is implemented, not merely visually simulated.
- Existing behavior is preserved unless intentionally changed.
- Failure and unavailable states are explicit.
- Inputs are validated and outputs are safely rendered.
- Backend and frontend contracts agree.
- Tests cover changed high-risk paths.
- Lint, builds, tests, and quality gates pass.
- No unrelated files or secrets are included.

---

## 2. Local validation playlist

### Q6. What is the minimum local validation command?

**A.** From the repository root:

```bash
npm test
npm run lint
npm run build:backend
npm run build:frontend
```

Use the package-local commands when debugging a specific subsystem:

```bash
cd ag-extension-dashboard/src/backend
npm test
npm run lint
npm run build

cd ../frontend
npm run test
npm run lint
npm run build:docker
```

### Q7. What does the backend build validate?

**A.** The backend build runs TypeScript compilation and alias rewriting. It catches type errors, invalid imports, and compilation failures, but it does not prove that external providers, databases, migrations, or production secrets are correctly configured.

### Q8. What does the frontend build validate?

**A.** The frontend build runs TypeScript compilation and Vite/PWA production bundling. It catches compile-time contract errors and bundling failures. It does not prove browser behavior, API availability, accessibility, or that a button performs a real backend operation.

### Q9. What does lint validate?

**A.** ESLint checks code style and configured correctness rules. It does not replace tests, typechecking, security review, or manual inspection of simulated and unavailable states.

### Q10. What does the full test command run?

**A.** The root `npm test` runs backend Jest tests and frontend Vitest tests. Both suites must pass. A passing test suite does not authorize deployment if builds, security checks, migrations, smoke tests, or required environment checks fail.

### Q11. How should a test failure be triaged?

**A.** Classify it before editing:

1. **Product regression:** implementation changed behavior incorrectly.
2. **Contract mismatch:** frontend/backend types or response semantics disagree.
3. **Environment failure:** database, Redis, provider, or credentials unavailable.
4. **Flaky test:** timing, async cleanup, or external dependency instability.
5. **Test defect:** assertion no longer represents intended behavior.

Fix the underlying category. Do not weaken assertions merely to make CI green.

### Q12. What is `git diff --check` for?

**A.** It catches whitespace errors and malformed patch formatting:

```bash
git diff --check
```

Run it before review and before committing.

---

## 3. Quality and Fallow gates

### Q13. What is Fallow used for?

**A.** Fallow provides static health and regression analysis, including dead code, complexity, duplication, dependency resolution, styling, and refactoring signals. It is a quality diagnostic, not a replacement for functional tests.

### Q14. Which Fallow commands should be run?

**A.** Run:

```bash
npm run fallow:audit
npm run fallow:check
npx fallow health --top 30
```

For machine-readable investigation:

```bash
npx fallow audit --base HEAD --format json
```

### Q15. What does “introduced” mean in a Fallow audit?

**A.** An introduced finding is attributed to the current change relative to the selected baseline. Inherited findings existed before the change. A clean regression result means the change did not add dead code, duplication, styling problems, or complexity findings under the configured comparison.

### Q16. Should inherited findings be ignored?

**A.** No. They should be recorded and prioritized separately. They may not block the current change if the gate is new-only, but they remain maintainability and risk debt.

### Q17. How should a complexity finding be fixed?

**A.** First identify the exact function and decision points. Then:

- Extract pure parsing, validation, formatting, and mapping helpers.
- Separate data loading from rendering.
- Replace repeated conditionals with typed maps or strategy functions when behavior is uniform.
- Split large React components by independent feature responsibility.
- Add tests for branches before or alongside refactoring.

Do not add a suppression solely to hide a newly introduced finding. Suppression requires a documented reason and should be reserved for intentional, tool-inaccurate cases.

### Q18. How should duplication findings be fixed?

**A.** Confirm the duplicate is behaviorally identical. Extract a shared helper, component, DTO, or middleware only when the abstraction has a stable responsibility. Avoid extracting unrelated code just because it looks textually similar. Re-run Fallow after each extraction.

### Q19. What dependency warnings need special care?

**A.** The monorepo has package boundaries. Before installing anything:

1. Check the relevant package manifest.
2. Confirm whether the dependency is already declared in the correct workspace.
3. Check `.fallowrc.json` and package-boundary configuration.
4. Only then add a dependency or an explicit, justified Fallow ignore.

Never install duplicate packages to silence an analyzer without checking the manifests.

---

## 4. Build and artifact questions

### Q20. Which package manager should be used?

**A.** Use the package manager already configured by the repository and lockfiles. Do not substitute `pnpm`, `yarn`, or `bun` for `npm` commands unless the project configuration explicitly requires it.

### Q21. What belongs in a production artifact?

**A.** Only compiled application assets and runtime dependencies required by the selected service. Development tools, test fixtures, local secrets, `.env` files, source maps with sensitive content, and demo-only credentials must not be copied into production images unless explicitly required and reviewed.

### Q22. How should Docker services be restarted safely?

**A.** Before restarting a Compose deployment, run:

```bash
docker compose down --remove-orphans
```

This prevents stale or orphaned containers from causing name conflicts and mismatched service state.

### Q23. What is the required order for Docker deployment?

**A.** The exact workflow may vary by environment, but the safe sequence is:

1. Validate configuration and secrets.
2. Ensure shared external networks exist.
3. Remove old Compose services with `down --remove-orphans`.
4. Build or pull the intended image digest.
5. Start services with the selected Compose profile.
6. Wait for health and readiness checks.
7. Run migrations through the approved migration process.
8. Run smoke probes.
9. Confirm logs and service status.
10. Record the release version and outcome.

### Q24. Why are persistent Buildx builders removed before recreation?

**A.** The project rules require removing persistent builders such as `remote-builder` or `stage-builder` before recreating them. This forces fresh GitHub token credentials to be loaded and avoids stale or expired authentication state:

```bash
docker buildx rm remote-builder 2>/dev/null || true
docker buildx rm stage-builder 2>/dev/null || true
```

Only run this as part of the approved workflow and never remove unrelated builders.

### Q25. Where should Docker cache exports go?

**A.** The deployment rules prefer local cache directories instead of remote GHCR cache exports when registry authorization or rate limits are a concern. Bake executions must include the appropriate filesystem permission, for example:

```bash
--allow=fs=/root
```

Cache paths should be explicit, isolated by target, and excluded from application artifacts.

### Q26. How should shared Compose networks be handled?

**A.** Shared networks such as `ag-network` should be external where required by the deployment architecture. The pipeline should verify or create the network before Compose starts:

```bash
docker network create --driver bridge ag-network || true
```

Do not silently convert an external shared network into a Compose-managed network; that can cause label conflicts and cross-service outages.

---

## 5. Secrets, environments, and permissions

### Q27. Where do production secrets belong?

**A.** In the CI/CD platform’s encrypted secrets/environment configuration or the approved server secret store. They must not be committed to Git, embedded in Dockerfiles, placed in frontend bundles, or printed in logs.

### Q28. Which environment values are especially sensitive?

**A.** At minimum:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `CREDENTIAL_ENCRYPTION_KEY`
- AI provider keys
- Stripe and PayPal credentials
- SMS, WhatsApp, Telegram, and email provider credentials
- GitHub tokens and registry credentials
- TLS/private-key material

### Q29. What is the frontend secret rule?

**A.** Anything sent to a browser is public. Frontend environment variables must never contain private provider credentials, database URLs, signing keys, or privileged service tokens. Private operations must go through the backend.

### Q30. What should a workflow’s permissions look like?

**A.** Use least privilege. A job should receive only the permissions required for its task. Separate read-only CI jobs from image publishing and deployment jobs. Avoid broad write permissions at workflow scope when job-level permissions are sufficient.

### Q31. How should logs be reviewed for secrets?

**A.** Review command output, error serialization, provider exceptions, migration errors, and debug logs. Redact authorization headers, connection strings, tokens, phone numbers when sensitive, and raw webhook payloads where they may contain personal data.

### Q32. What is the environment promotion rule?

**A.** Build once where practical, then promote the same verified artifact through environments. Do not rebuild different code from an unreviewed branch between staging and production. Environment-specific configuration belongs outside the image.

---

## 6. Database and migration Q&A

### Q33. What must be checked before migrations?

**A.** Confirm:

- The target database is the intended environment.
- A backup or recovery point exists where required.
- The migration status is known.
- The application version is compatible with the schema.
- No competing migration process is running.
- The migration command is the one defined by the repository.

### Q34. What if a migration says a table or column already exists?

**A.** Do not blindly rerun or edit migration history. Inspect the schema and migration state. If the deployment rules apply, parse the conflicting migration name and resolve it as applied using Prisma’s approved command:

```bash
npx prisma migrate resolve --applied <migration-name>
```

Record why the resolution was safe. Never mark a migration applied without verifying that its schema changes already exist.

### Q35. Should migrations run before or after the application starts?

**A.** Follow the environment’s established deployment workflow. The important requirements are serialized execution, readiness of the database, compatibility between application and schema, and clear failure handling. Never hide migration failure behind a successful container start.

### Q36. What is a safe migration rollback?

**A.** Prisma migration rollback is not automatically equivalent to reversing a migration. Use a tested forward-fix or the repository’s documented recovery procedure. If data may be affected, stop promotion and involve the database owner before attempting destructive changes.

### Q37. How should database failures appear to users?

**A.** A database outage must not look like valid empty analytics, zero usage, or successful persistence. APIs should return explicit unavailable/error metadata and appropriate HTTP status codes. Frontends should display an unavailable state and avoid fabricating values.

---

## 7. Health checks and smoke gates

### Q38. What is the difference between liveness and readiness?

**A.** Liveness answers whether the process is running. Readiness answers whether the service can safely receive traffic, including required dependencies and initialization. A live process can be unready.

The dashboard exposes:

- `/health` and `/api/health` for fuller dependency health.
- `/health/live` for liveness.
- `/health/ready` for readiness.

### Q39. How should container probes be executed?

**A.** Use Node’s native `fetch` in minimal images rather than assuming `curl` exists:

```bash
node -e "fetch('http://localhost:PORT/health/ready').then(async r => { console.log(r.status); process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))"
```

Replace `PORT` with the service’s configured internal port.

### Q40. What should a smoke test verify?

**A.** At minimum:

- The container is running.
- Readiness returns success.
- The frontend asset is served.
- The API responds through the intended proxy path.
- Database and cache dependencies report the expected state.
- Authentication boundaries remain active.
- A representative read-only endpoint works.
- No critical startup error appears in logs.

### Q41. What should happen if a smoke gate fails?

**A.** Stop promotion. Capture the release identifier, service status, recent logs, health response, and deployment step that failed. Do not continue to later deployment stages or report success.

### Q42. Why should smoke tests avoid `curl` assumptions?

**A.** Production and slim build images may not contain external utilities. A probe that works only because a development image has `curl` can produce false confidence. Node is already part of this stack and provides a portable native HTTP client.

---

## 8. Release and deployment questions

### Q43. What is the staging release checklist?

**A.** Before staging:

- Confirm the branch and commit SHA.
- Confirm required checks passed.
- Confirm environment secrets exist without printing them.
- Confirm database migration status.
- Confirm image tag or digest.
- Confirm external network prerequisites.
- Run Compose cleanup and deploy.
- Run readiness and smoke checks.
- Verify representative frontend and API flows.
- Record any expected unavailable integrations.

### Q44. What is the production release checklist?

**A.** In addition to staging checks:

- Obtain the required approval.
- Confirm staging validation used the same artifact or digest.
- Confirm backups/recovery point and rollback plan.
- Confirm monitoring and alert routing.
- Confirm maintenance or communication requirements.
- Confirm migration compatibility and execution ownership.
- Deploy in the documented order.
- Run production smoke checks.
- Monitor error rate, latency, worker queues, database, Redis, and provider failures.

### Q45. What does “deployment succeeded” mean?

**A.** It means the intended artifact was deployed, services reached readiness, migrations completed or were safely reconciled, smoke tests passed, and no critical errors were observed in the defined observation window. A successful SSH command or container start alone is not deployment success.

### Q46. How should a deployment be versioned?

**A.** Record the Git commit SHA, image tag/digest, migration state, environment, workflow run, and operator or automation identity. Avoid mutable-only tags such as `latest` as the sole release identifier.

### Q47. What is the rollback decision rule?

**A.** Roll back or stop traffic when the release causes unavailable core functionality, data corruption risk, authentication failure, severe error-rate increase, failed readiness, or unsafe migration behavior. Prefer the least destructive recovery that restores service while preserving evidence.

### Q48. What should not be done during rollback?

**A.** Do not:

- Force-reset a database without approval.
- Delete volumes to “fix” a migration.
- Push directly to production branches.
- Rewrite Git history.
- Remove containers without preserving logs when incident evidence matters.
- Mark migrations applied to suppress an error without schema verification.

---

## 9. Security and supply-chain playlist

### Q49. What should security CI cover?

**A.** The repository identifies security test and audit commands:

```bash
npm run security:test
npm run security:audit
```

The security workflow should cover secrets, dependency vulnerabilities, authentication boundaries, input validation, webhook verification, upload handling, authorization, and production configuration.

### Q50. What is the rule for third-party dependencies?

**A.** Verify the library is already used before introducing it. Prefer existing dependencies and platform APIs. Review license, maintenance, transitive dependencies, lockfile changes, and whether the package is needed in production or only development.

### Q51. How should webhook deployments be validated?

**A.** Verify signature validation, timestamp/replay controls where supported, tenant/account association, payload shape validation, idempotency, and outbound delivery result handling. A webhook handler must not return or log success when the actual downstream operation failed.

### Q52. What is the upload security checklist?

**A.** Validate size, MIME type, extension, content signature where appropriate, storage destination, authorization, filename handling, and malware/content scanning policy. Never trust client-provided file names or MIME values. Do not expose uploaded files publicly by default.

### Q53. What is the log privacy checklist?

**A.** Do not log passwords, tokens, full payment data, raw provider authorization headers, unnecessary farmer personal data, or unredacted webhook bodies. Use correlation IDs and structured error categories instead.

---

## 10. Failure diagnosis playlist

### Q54. The workflow fails during dependency installation. What do I check?

**A.** Check:

1. Lockfile consistency.
2. Node version and package-manager version.
3. Registry availability and authentication.
4. Workspace/package boundaries.
5. Whether a private package requires a token.
6. Whether the failure is a transient registry issue.

Do not immediately delete lockfiles or caches; preserve the failure context first.

### Q55. The backend builds locally but fails in CI. Why?

**A.** Common causes include different Node versions, missing generated files, environment-dependent imports, case-sensitive filesystem behavior, package-boundary differences, uncommitted files, or CI using a different working directory. Reproduce using the same Node and command from a clean checkout.

### Q56. The frontend builds but the deployed page is blank. What do I check?

**A.** Check:

- Browser console and network errors.
- Base path and asset URLs.
- SPA fallback routing.
- Runtime environment variables.
- API origin/CORS.
- Service worker cache.
- Static asset permissions and proxy rules.
- Whether the deployed artifact matches the expected commit.

### Q57. Containers start but readiness fails. What do I check?

**A.** Inspect service logs, readiness response body, database connectivity, Redis connectivity, migrations, required environment variables, listening ports, DNS/network membership, and dependency health. Do not convert readiness failure into success by weakening the probe.

### Q58. The application returns empty data after deployment. Is that healthy?

**A.** Not necessarily. Distinguish valid empty data from unavailable dependencies, authorization filtering, migration/schema mismatch, failed ingestion, and provider outage. API metadata should make the distinction explicit.

### Q59. A provider is unavailable. What should the application do?

**A.** Use an approved fallback only if it is real, bounded, and clearly labeled. Otherwise return an explicit unavailable state. Never substitute fabricated live-looking values, random telemetry, guessed coordinates, fake citations, or synthetic success messages.

### Q60. A deployment command hangs. What do I do?

**A.** Determine whether it is waiting for input, waiting on a network, blocked by a lock, or running a long build. Use non-interactive flags where safe, inspect process and service logs, and stop only with an approved timeout/recovery procedure. Do not run destructive cleanup as a first response.

### Q61. A workflow reports success but the service is broken. What likely failed?

**A.** The workflow may be checking command exit codes without checking readiness, smoke behavior, migration outcome, proxy routing, or application-level errors. Strengthen the gate so success reflects user-visible service health, not only process completion.

---

## 11. Branch, review, and merge Q&A

### Q62. What files should be included in a pull request?

**A.** Only files directly related to the requested change, tests, documentation, and required configuration. Review `git status`, `git diff`, and generated artifacts. Avoid committing local build output, secrets, logs, temporary reports, and unrelated pre-existing modifications.

### Q63. What should reviewers look for in CI changes?

**A.** Review:

- Trigger scope and branch filters.
- Job dependencies and failure propagation.
- Permissions.
- Secret exposure.
- Environment protection.
- Cache correctness.
- Artifact provenance.
- Migration ordering.
- Smoke-test coverage.
- Rollback behavior.
- Whether skipped jobs can accidentally produce a green workflow.

### Q64. Can a failed optional job be ignored?

**A.** Only if the job is explicitly non-blocking by design, documented, and does not cover a release safety requirement. Security, build, test, migration, readiness, and deployment jobs should generally be blocking.

### Q65. What must happen before merging to the protected branch?

**A.** Required checks must pass, review must be complete, the diff must be understood, and the branch must follow the repository’s stage/master policy. Do not merge around failed required checks.

### Q66. What is a good CI commit message?

**A.** State the intent and safety impact, for example:

- `Harden staging readiness gate before deployment`
- `Use immutable image digest in production rollout`
- `Fail deployment when database migration reconciliation is unsafe`

Avoid vague messages such as `Update workflow`.

---

## 12. Operational scenarios

### Q67. Scenario: tests pass, but Fallow reports new duplication. What do I do?

**A.** Inspect the exact clone group and attribution. If the code is newly duplicated, extract a stable shared abstraction and rerun tests. If Fallow is matching intentionally similar route wrappers, verify behavior and document why the duplication is unavoidable rather than blindly suppressing it.

### Q68. Scenario: Fallow reports inherited complexity in a touched file. Is the release blocked?

**A.** Follow the configured gate. If only new findings block the change and no new complexity is introduced, record the inherited issue and create follow-up work. If the change materially expands the hotspot, refactor or add tests before merging.

### Q69. Scenario: a deployment has a migration conflict. What is the safe response?

**A.** Pause deployment, identify the exact migration and schema state, verify whether the change already exists, and use the documented Prisma resolution only when justified. Record the decision and rerun migration status plus readiness checks.

### Q70. Scenario: Redis is down but the API is running. Can the release be marked successful?

**A.** Only if Redis is explicitly optional for that service and the documented readiness contract says so. If Redis is required for cache, queues, Socket.IO, rate limiting, or background work, readiness should fail or clearly report degraded operation. Do not hide the dependency failure.

### Q71. Scenario: an AI provider fails. Can the UI show a generic agronomic answer?

**A.** No, not unless that answer comes from a clearly bounded and approved source. Show an unavailable/error state or use a real configured fallback provider. Do not fabricate citations, measurements, confidence values, or field-specific prescriptions.

### Q72. Scenario: the frontend displays “sent” after an SMS request. Is the HTTP response enough?

**A.** No. “Sent” should reflect the backend’s actual delivery contract. Distinguish accepted/queued, provider-accepted, delivered, failed, and unknown. The UI must not show success when `{ success: false }` or when the request only entered a queue.

### Q73. Scenario: a report export downloads a file. Does that prove the report is valid?

**A.** No. Validate the report type, tenant scope, data availability, content generation, MIME type, filename, and export status. An empty or unsupported report must not be presented as a completed report.

### Q74. Scenario: a provider credential is absent in staging. What should happen?

**A.** The affected integration should report not configured or unavailable. It must not return mock pricing, fake telemetry, placeholder IDs, guessed geography, or fabricated success. If the feature is intentionally demo-only, label it as such and prevent it from writing production records.

---

## 13. Release evidence template

Copy this template into a release record or deployment issue:

```text
Release:
Environment:
Workflow run:
Commit SHA:
Image tag/digest:
Operator/automation:

Preflight:
- [ ] Required checks passed
- [ ] Security checks passed
- [ ] Secrets/configuration verified without exposure
- [ ] Migration status reviewed
- [ ] Backup/recovery point confirmed
- [ ] External network prerequisites confirmed

Deployment:
- [ ] Old Compose services removed safely
- [ ] Intended artifact started
- [ ] Migrations completed or safely reconciled
- [ ] Readiness passed
- [ ] Smoke probes passed
- [ ] Representative UI/API flow verified

Observation:
- Error rate:
- Latency:
- Database:
- Redis:
- Workers/queues:
- External providers:
- Alerts:

Outcome: success / failed / rolled back
Notes:
Follow-up owner:
```

---

## 14. Final operator checklist

Before declaring a release complete, answer “yes” to all applicable questions:

1. Did the workflow build the intended commit?
2. Did typechecks, lint, and tests pass?
3. Did security checks pass?
4. Did Fallow introduce no unreviewed regression?
5. Were secrets protected?
6. Were migrations verified?
7. Did services reach readiness?
8. Did smoke tests exercise the real proxy and API paths?
9. Were unavailable integrations reported honestly?
10. Were logs reviewed for critical errors and sensitive data?
11. Is the artifact and release evidence recorded?
12. Is rollback understood and still possible?

A release is not complete because a pipeline is green. It is complete when the verified artifact is running, observable, recoverable, and truthful about its operational state.
