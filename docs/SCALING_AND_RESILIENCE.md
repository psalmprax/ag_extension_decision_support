# Scaling and resilience

How the platform stays up, keeps its data and grows past one server. Code and templates for everything
below are in the repository; the items marked **server setting** need values only the operator can supply.

## 1. Database

- Production runs one Postgres container with the `db-backup` sidecar.
- When one machine is no longer enough, move to a managed Postgres (point-in-time recovery, a standby in a
  second zone). The backend only needs `DATABASE_URL`; migrations run through `prisma migrate deploy` and take
  an advisory lock, so two backends never migrate at once.
- Read replicas are not used yet: every query goes to the primary.

## 2. Backups

- The sidecar (`scripts/db-backup-sidecar.sh`) writes a nightly `pg_dump` to the backups volume.
- **Server setting:** with `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`,
  `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` and `BACKUP_ENCRYPTION_PASSPHRASE` set, each dump is
  also encrypted (AES-256, openssl) and copied to S3-compatible storage in another provider or region. Remote
  copies older than `BACKUP_S3_RETENTION_DAYS` (default 35) are pruned.
- Keep the passphrase outside the server too: without it the off-site copies cannot be read.

## 3. Restore drill

- `sh scripts/restore-drill.sh` (on the server, from `ag-extension-dashboard/`) restores the newest backup into a
  throwaway container, checks the main tables have rows, and removes the container. The live database is not
  touched.
- The `Restore drill` workflow runs the same script on the server on demand. Run it at least monthly and after
  any change to the backup settings.

## 4. Uploaded files

- Photos, voice notes and documents are stored on the backend container's disk unless object storage is set.
- **Server setting:** `STORAGE_BACKEND=s3` (or `r2`) with `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `scripts/uploads-to-object-storage.ts` copies existing files from disk into the bucket once.
- The backend warns at start-up when production uses local disk, and a replica refuses to start on local disk.

## 5. More than one backend

- `docker-compose.scale.yml` adds `backend-2` behind Traefik (needs Docker Compose 2.24 or newer):

  ```sh
  docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.scale.yml up -d
  ```

- Background jobs run on one elected leader at a time, live updates fan out through the Socket.IO Redis adapter,
  and a sticky cookie keeps a browser's polling on one container.
- Uploads must be in object storage first (section 4).
- `k8s/` holds a starting deployment and namespace only. It is not used in production and has no ingress,
  secrets or autoscaling yet; the Compose files are the supported way to run the platform.

## 6. Monitoring

- The `Uptime` workflow checks the API and the app every 15 minutes. When either does not answer it opens an issue
  labelled `outage`; when both answer again it comments and closes it.
- Errors go to Sentry when `SENTRY_DSN` is set.

## 7. Messaging limits

- SMS above the provider's per-minute limit are queued and sent when the limit allows, not dropped.
- **Server setting:** `AFRICASTALKING_WEBHOOK_SECRET`, so delivery reports and inbound messages are verified.

## 8. Upload scanning

- Uploaded files are scanned by ClamAV. `CLAMD_FAIL_OPEN` defaults to `false`: when the scanner is down, uploads are
  refused rather than accepted unscanned. The backend warns at start-up when it is set to `true`.
