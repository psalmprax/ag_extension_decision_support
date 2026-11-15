# Historical / manual SQL — NOT part of the deploy path

Nothing executes this folder. The schema's single source of truth is
`../prisma/migrations/`, applied with `prisma migrate deploy` (the docker
entrypoint does this before boot; CI replays the chain on a fresh database
via `scripts/prisma-migration-replay-check.cjs`).

Status of these files:

- `002_add_pgvector_support.sql`, `003_convert_to_pgvector_native.sql` —
  optional pgvector enablement. Run manually, only on hosts whose Postgres
  has the `vector` extension available. The application works without them
  (`cosine_similarity` falls back to a portable plpgsql implementation).
- `add_notifications_table.sql` — creates `scheduled_notifications`, which no
  current code reads or writes. Kept for reference only.
- everything else — superseded by `../prisma/migrations/` (see
  `20260614143047_sync_schema_to_prisma` and
  `20261115120000_consolidate_runtime_ddl`). Do not run.

Add new schema changes as Prisma migrations, never here and never as
boot-time DDL in services.
