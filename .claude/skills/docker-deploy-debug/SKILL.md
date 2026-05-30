---
name: docker-deploy-debug
description: Debug and troubleshoot Docker Compose services, Traefik reverse proxy, container networking, and deployment. Use when investigating service startup failures, routing issues, port conflicts, or production deployment problems.
---

# Docker / Deployment Debugging

## Quick Diagnostics

```bash
# Check all services
docker compose ps

# Check service logs
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs app-db --tail=50
docker compose logs redis --tail=50
docker compose logs traefik --tail=50

# Check resource usage
docker stats --no-stream

# Check network
docker network inspect ag-network

# Test internal connectivity
docker compose exec backend curl http://app-db:5432  # will fail but shows DNS resolution
docker compose exec backend curl http://redis:6379   # same
```

## Architecture

### Service Stack

| Service | Image | Port (host) | Port (container) | Purpose |
|---|---|---|---|---|
| app-db | Custom (Dockerfile.db) | 7501 | 5432 | PostgreSQL |
| redis | redis:alpine | 7502 | 6379 | Cache + queues |
| traefik | traefik:v3.7 | 80 | 80 | Reverse proxy |
| backend | Node.js | 7500 | 3001 | API server |
| frontend | Vite | 7503 | 5173 | React SPA |
| ettametta-ollama | ollama/ollama | 11435 | 11434 | Local LLM |

### Networks

| Network | Purpose |
|---|---|
| ag-network | Main internal network (all services) |
| ettametta_ettametta | Shared network with ettametta project (Ollama) |

### Traefik Routing

```
Host(`www.gpexts.com`) || Host(`localhost`) || Host(`145.223.97.248`)
  -> PathPrefix(`/api`) || `/api-docs` || `/socket.io` || `/health` -> backend:3001
  -> Everything else -> frontend:5173
```

## Key Files

| File | Purpose |
|---|---|
| docker-compose.yml | Main service definitions |
| docker-compose.prod.yml | Production overrides (TLS, Traefik) |
| docker-compose.agents.yml | Agent service definitions |
| Dockerfile.db | Custom PostgreSQL image |
| deploy-docker.sh | Deployment script |
| .env | Environment variables |

## Common Issues

### Port conflicts

```bash
# Check if ports are in use
ss -tlnp | grep -E "7500|7501|7502|7503|80|11435"

# Kill conflicting process
sudo fuser -k 7500/tcp
```

### Container won't start

```bash
# Check logs
docker compose logs backend --tail=100

# Check if image built successfully
docker compose build backend --no-cache

# Check env vars
docker compose exec backend env | sort
```

### Traefik not routing

```bash
# Check Traefik is running
docker compose ps traefik

# Check Traefik config
docker compose exec traefik cat /etc/traefik/traefik.yml  # if mounted

# Check Traefik discovers services
docker compose logs traefik | grep -i "router\|service\|error"

# Test direct backend access (bypass Traefik)
curl http://localhost:7500/health
```

### Database not ready when backend starts

Backend depends_on `app-db` but PostgreSQL may not be fully initialized. Check:
```bash
docker compose logs app-db | grep "ready to accept connections"
```
If timing issue, add healthcheck to app-db service.

### Ollama not connecting

Ollama is on shared network `ettametta_ettametta`. Backend connects via `OLLAMA_HOST` env var.
```bash
# Check Ollama is running
docker compose ps ettametta-ollama

# Test from backend
docker compose exec backend curl http://ettametta-ollama:11434/api/tags
```

### Production deployment (HTTPS)

```bash
# Use prod override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Requires:
- `DOMAIN` env var
- DNS pointing to server
- Traefik Let's Encrypt config in prod override

### Volume data loss

```bash
# List volumes
docker volume ls | grep ag

# Backup PostgreSQL
docker compose exec app-db pg_dump -U postgres ag_extension > backup.sql

# Backup Redis
docker compose exec redis redis-cli BGSAVE
```

### ettametta network missing

The `ettametta_ettametta` network must exist. If not:
```bash
docker network create ettametta_ettametta
```
