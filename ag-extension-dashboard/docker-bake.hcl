# Local BuildKit cache directory. The deploy workflows export it as
# $HOME/docker-cache so a non-root deploy user works; the default keeps manual
# runs as root unchanged.
variable "DOCKER_CACHE_DIR" {
  default = "/root/docker-cache"
}

variable "GITHUB_REPOSITORY" {
  default = "psalmprax/ag_extension_decision_support"
}

group "default" {
  targets = ["backend", "frontend", "agent-zero", "crew-ai", "discovery-scraper"]
}

group "web" {
  targets = ["backend", "frontend"]
}

group "agents" {
  targets = ["agent-zero", "crew-ai", "discovery-scraper"]
}

target "backend" {
  context     = "../"
  dockerfile  = "ag-extension-dashboard/src/backend/Dockerfile"
  target      = "production"
  # Tag matches docker-compose's internal naming: <project>-<service>
  # COMPOSE_PROJECT_NAME is "ag-extension-dashboard" (from directory name)
  tags        = ["ag-extension-dashboard-backend:latest"]
  cache-from  = ["type=local,src=${DOCKER_CACHE_DIR}/backend", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:backend"]
  cache-to    = ["type=local,dest=${DOCKER_CACHE_DIR}/backend,mode=max"]
}

target "frontend" {
  context     = "../"
  dockerfile  = "ag-extension-dashboard/src/frontend/Dockerfile"
  tags        = ["ag-extension-dashboard-frontend:latest"]
  cache-from  = ["type=local,src=${DOCKER_CACHE_DIR}/frontend", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:frontend"]
  cache-to    = ["type=local,dest=${DOCKER_CACHE_DIR}/frontend,mode=max"]
}

target "agent-zero" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.agent-zero"
  tags        = ["ag-extension-dashboard-agent-zero:latest"]
  cache-from  = ["type=local,src=${DOCKER_CACHE_DIR}/agent-zero", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:agent-zero"]
  cache-to    = ["type=local,dest=${DOCKER_CACHE_DIR}/agent-zero,mode=max"]
}

target "crew-ai" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.crew-ai"
  tags        = ["ag-extension-dashboard-crew-ai:latest"]
  cache-from  = ["type=local,src=${DOCKER_CACHE_DIR}/crew-ai", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:crew-ai"]
  cache-to    = ["type=local,dest=${DOCKER_CACHE_DIR}/crew-ai,mode=max"]
}

target "discovery-scraper" {
  context     = "./src/agents/tools/cloakbrowser"
  dockerfile  = "Dockerfile.discovery-scraper"
  tags        = ["ag-extension-dashboard-discovery-scraper:latest"]
  cache-from  = ["type=local,src=${DOCKER_CACHE_DIR}/discovery-scraper", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:discovery-scraper"]
  cache-to    = ["type=local,dest=${DOCKER_CACHE_DIR}/discovery-scraper,mode=max"]
}

