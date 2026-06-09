# Smart Deployment Automation Guide

This guide details the exact steps to manually run the "Smart Deployment" directly on the production server. This approach is specifically designed to bypass GitHub Actions' strict 6-hour timeout limits when compiling massive machine learning dependencies. 

Most importantly, this approach **guarantees zero data loss** because it explicitly targets application containers while leaving the Database and Redis volumes untouched.

> **Tip**: The missing port 443 issue occurred because the `docker-compose.prod.yml` override file (which configures Traefik's Let's Encrypt SSL resolvers) was accidentally omitted from the manual `docker compose up` command. When omitted, it reverts to the local development mode (port 80 only). This guide explicitly includes it.

## 1. Access the Production Server

First, securely SSH into your remote server:
```bash
ssh -i /path/to/your/id_key root@145.223.97.248
```

## 2. Navigate to the Directory and Pull Updates

Ensure you are in the correct repository folder and fetch the latest `master` branch. This will grab any workflow or code changes pushed from GitHub.

```bash
cd /root/ag_extension_decision_support
git fetch origin master
git reset --hard origin/master
cd ag-extension-dashboard
```

## 3. The "Smart Deployment" Build & Run (Zero Data Loss)

To rebuild and redeploy the services **without formatting your Database or Redis cache**, explicitly list the services you want to update at the end of the `docker compose up` command. 

> **IMPORTANT**: You **must** include the `-f docker-compose.prod.yml` flag. This file is what exposes Port 443 and configures Traefik to generate SSL certificates via Let's Encrypt for `www.gpexts.com`.

Run the following command to rebuild and recreate the applications and AI agents:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.agents.yml \
  up -d --build traefik backend frontend agent-zero crew-ai
```

### What this command does:
1. **Reads Production Configs:** Uses the production overrides to enable SSL (443) and production environment variables.
2. **Builds:** Compiles the latest code into images using Docker's cache.
3. **Recreates:** Shuts down the old `frontend`, `backend`, `traefik`, `agent-zero`, and `crew-ai` containers and starts new ones.
4. **Preserves Data:** Because `app-db` and `redis` are **not** listed at the end of the command, Docker ignores them completely. They keep running safely in the background with their underlying volumes untouched.

## 4. Troubleshooting: "Conflict: Container name is already in use"

If Docker Compose throws an error stating that the container name is already in use (e.g., `/ag-dashboard-db` conflict), it means Docker Compose detected a stale container shell that wasn't cleanly detached during a previous deployment.

To resolve this safely:

```bash
# 1. Manually remove the conflicted container shells.
# Note: This does NOT delete the volume data!
docker rm -f ag-dashboard-db ag-dashboard-redis

# 2. Re-run the full deployment (this time without listing specific services)
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.agents.yml \
  up -d
```
Because the `ag-extension-dashboard_postgres_data` volume still exists on the host machine, Docker Compose will spin up fresh DB containers and seamlessly attach them to your existing data.
