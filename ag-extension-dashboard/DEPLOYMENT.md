# AG-Extension Deployment & Migration Strategy

This document outlines the professional deployment architecture, CI/CD workflows, and data migration strategies for the AG-Extension platform.

---

## 🏗️ 1. Infrastructure Overview

The platform is divided into two distinct environments to ensure stability and safe testing.

| Environment | Purpose | Server IP | Branch |
| :--- | :--- | :--- | :--- |
| **Testing** | Sandbox for new features & UAT | `161.97.126.84` | `stage`, `feature/*` |
| **Production** | Live environment for users | `145.223.97.248` | `master` |

---

## 🔄 2. CI/CD Workflow (GitHub Actions)

The deployment is fully automated via GitHub Actions in `.github/workflows/deploy-all.yml`.

### A. Testing Pipeline (Old Server)
*   **Trigger**: On every `push` to `stage` or `feature/*` branches.
*   **Action**: Automates code sync and updates application containers.
*   **Safety**: Uses "Smart Deploy" to detect if Postgres/Redis are already running; if they are, it only restarts the App services to preserve data.

### B. Production Pipeline (New Server)
*   **Trigger**: Only when a **Pull Request is merged** into `master`.
*   **Action**: Executes a safe deployment using the orchestration script.
*   **Safety**: Strictly follows the "Review -> Merge -> Deploy" pattern.

---

## 🛠️ 3. Universal Orchestration Script

The core of the deployment logic is contained in `scripts/orchestrate-migration.sh`. This script is **Universal** and **Cloud-Agnostic**.

### Usage Commands:
```bash
./scripts/orchestrate-migration.sh <command>
```

| Command | Description | Best Use Case |
| :--- | :--- | :--- |
| `deploy` | Syncs code and updates app containers. | Routine updates to code (Backend/Frontend). |
| `migrate-data` | Full Docker-to-Docker migration (DB + Volumes). | Moving between VPS servers (Current strategy). |
| `migrate-cloud` | Postgres migration between two Cloud endpoints. | Moving between RDS instances or Azure/GCP. |
| `docker-to-cloud`| Dumps Docker DB and restores to a Cloud endpoint. | Scaling up from VPS to AWS RDS / Azure SQL. |
| `extract-redis` | Extracts `.rdb` snapshot for Cloud ingestion. | Moving to AWS ElastiCache / Azure Redis. |

---

## 🐘 4. Database Migration Strategies

### Docker ➡️ Docker (VPS to VPS)
Uses `pg_dumpall` inside containers and transfers snapshots via `scp`. This ensures users, roles, and all database data are perfectly synchronized.

### Docker ➡️ Cloud (Scaling Up)
Allows you to bridge the gap between a self-hosted container and a managed service like **AWS RDS**.
1. Dump from Docker container.
2. Restore to Cloud Endpoint using local `psql` client.

### Cloud ➡️ Cloud
Direct network migration between endpoints. No Docker overhead.

---

## 🤖 5. Agent Data Migration
The script handles persistent data for AI Agents (`agent-zero` and `crew-ai`) by:
1. Creating a tarball of the Docker Volume at the source.
2. Transferring and uncompressing it at the destination.
3. This ensures that agent memory and logs are never lost during a server move.

---

## 🔐 6. Required GitHub Secrets
To enable the automated pipeline, ensure the following secrets are set in your GitHub repository:
*   `TEST_SERVER_IP`: `161.97.126.84`
*   `PROD_SERVER_IP`: `145.223.97.248`
*   `SSH_PRIVATE_KEY_TESTING`: Content of your testing SSH key.
*   `SSH_PRIVATE_KEY_PRODUCTION`: Content of your production SSH key.

---

---

## 🛡️ 8. Production Hardening & Operational Resilience

The platform includes several hardening features to ensure high availability and performance.

### A. Automated Database Backups
*   **Script**: `scripts/db-backup.sh`
*   **Workflow**: Creates compressed daily snapshots of the PostgreSQL database.
*   **Retention**: Automatically rotates backups, keeping the last **7 days** of data.
*   **Storage**: Backups are stored in `~/ag_backups/` on the host server.

### B. AI Performance (Semantic Caching)
*   **Feature**: Integrated `SemanticCacheService` in AI routes.
*   **Benefit**: Checks the vector database for similar historical queries before calling the LLM. 
*   **Outcome**: Drastically reduces token costs and latency for repetitive synthesis requests.

### C. API Security (Rate Limiting)
*   **Strategy**: Per-User Rate Limiting via `rateLimitMiddleware.ts`.
*   **Quotas**:
    *   **Admins**: 10,000 requests / 15 mins.
    *   **Auth Users**: 500 requests / 15 mins.
    *   **Guests**: 50 requests / 15 mins.

### D. Frontend Resilience
*   **Lazy Loading**: Heavy components (Maps/Charts) use `React.lazy` to minimize initial load time.
*   **Error Boundaries**: Granular boundaries prevent a single module (e.g., the Map) from crashing the entire dashboard.
*   **Skeletons**: Metric cards and charts use professional skeleton states to improve perceived speed.

---

## 🛠️ 9. Troubleshooting
*   **500 Errors after move**: Ensure the `.env` file on the new server has the correct `DATABASE_URL` and `REDIS_URL`.
*   **Port Conflicts**: Backend is on `:7500`, DB is on `:7501`, Redis is on `:7502`, Frontend is on `:7503`.
*   **LLM Connection**: Ensure `OLLAMA_HOST` in `.env` points to the correct IP if Ollama is running on a different server.
