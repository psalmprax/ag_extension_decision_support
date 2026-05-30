---
name: database-debug
description: Debug and troubleshoot PostgreSQL, Prisma ORM, and pgvector. Use when investigating connection issues, migration conflicts, slow queries, pgvector problems, or schema drift.
---

# Database Debugging

## Quick Diagnostics

```bash
# Check PostgreSQL is running
docker compose ps app-db

# Connect to database
docker compose exec app-db psql -U postgres -d ag_extension

# Check table counts
docker compose exec app-db psql -U postgres -d ag_extension -c "\dt"

# Check knowledge_articles schema
docker compose exec app-db psql -U postgres -d ag_extension -d ag_extension -c "\d knowledge_articles"

# Check embedding dimensions
docker compose exec app-db psql -U postgres -d ag_extension -c "SELECT array_length(embedding, 1) as dim FROM knowledge_articles WHERE embedding IS NOT NULL LIMIT 1;"

# Check recent migrations
cd src/backend && npx prisma migrate status

# Slow queries (if pg_stat_statements enabled)
docker compose exec app-db psql -U postgres -d ag_extension -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

## Architecture

### Database Stack

```
PostgreSQL (Docker)
  -> Prisma ORM (schema + migrations)
  -> Raw SQL via databaseService.ts (pg driver)
  -> pgvector-style embeddings (custom cosine_similarity function)
```

### Dual Access Pattern

The project uses **both** Prisma and raw `pg` driver:
- Prisma: schema management, migrations, some queries
- Raw SQL: vector search, knowledge articles, complex queries

This is intentional — Prisma doesn't natively support pgvector operations.

### Key Tables

| Table | Purpose |
|---|---|
| knowledge_articles | RAG knowledge store with embeddings |
| knowledge_searches | Search query log for analytics |
| users | User accounts |
| farmers | Farmer profiles |
| visits | Scheduled visits |
| alerts | Disease/weather alerts |

## Key Files

| File | Purpose |
|---|---|
| src/backend/prisma/schema.prisma | Prisma schema definition |
| src/backend/src/services/databaseService.ts | Raw SQL query helper (pg pool) |
| src/backend/src/services/prismaService.ts | Prisma client singleton |
| src/backend/src/services/vectorService.ts | Vector operations (uses raw SQL) |
| src/backend/Dockerfile.db | Custom PostgreSQL image |

## Common Issues

### Connection refused

```bash
# Check container
docker compose ps app-db

# Check port mapping
docker compose exec app-db psql -U postgres -c "SELECT 1"

# Check DATABASE_URL
docker compose exec backend env | grep DATABASE_URL
```

### Migration conflicts

```bash
cd src/backend
npx prisma migrate status
npx prisma migrate resolve --applied <migration_name>  # if stuck
```

### pgvector / embedding issues

The project uses a custom `cosine_similarity()` SQL function, not the pgvector extension. If search fails:
```sql
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'cosine_similarity';

-- Check embedding format
SELECT id, array_length(embedding, 1) FROM knowledge_articles WHERE embedding IS NOT NULL LIMIT 5;
```

### Dimension mismatch

If you switch embedding models, existing embeddings have old dimensions. New queries will fail or return garbage. Fix: re-ingest all knowledge.

### Slow queries on knowledge_articles

```sql
-- Check indexes
\d knowledge_articles

-- Missing index on category?
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);

-- Missing index on crops?
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_crops ON knowledge_articles USING GIN(crops);
```

### Prisma vs raw SQL confusion

Some tables are accessed via Prisma, others via raw SQL. If a table seems to "not exist", check which access method is being used.
