# ============================================================
# docker-bake.hcl — Build targets for ag-extension services
# ============================================================
# Usage:
#   Default (no cache):   docker buildx bake
#   With GHCR cache:      docker buildx bake --set "*.cache-from=type=registry,ref=ghcr.io/OWNER/REPO/buildcache:{{.Name}}" --set "*.cache-to=type=registry,ref=ghcr.io/OWNER/REPO/buildcache:{{.Name}},mode=max"
# ============================================================

group "default" {
  targets = ["backend", "frontend", "agent-zero", "crew-ai"]
}

target "backend" {
  context     = "./src/backend"
  dockerfile  = "Dockerfile"
  # Tag matches docker-compose's internal naming: <project>_<service>
  # COMPOSE_PROJECT_NAME is "ag-extension-dashboard" (from directory name)
  tags        = ["ag-extension-dashboard_backend:latest"]
}

target "frontend" {
  context     = "./src/frontend"
  dockerfile  = "Dockerfile"
  tags        = ["ag-extension-dashboard_frontend:latest"]
}

target "agent-zero" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.agent-zero"
  tags        = ["ag-extension-dashboard_agent-zero:latest"]
}

target "crew-ai" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.crew-ai"
  tags        = ["ag-extension-dashboard_crew-ai:latest"]
}
