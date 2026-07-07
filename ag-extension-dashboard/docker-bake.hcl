variable "GITHUB_REPOSITORY" {
  default = "psalmprax/ag_extension_decision_support"
}

group "default" {
  targets = ["backend", "frontend", "agent-zero", "crew-ai"]
}

target "backend" {
  context     = "./src/backend"
  dockerfile  = "Dockerfile"
  # Tag matches docker-compose's internal naming: <project>-<service>
  # COMPOSE_PROJECT_NAME is "ag-extension-dashboard" (from directory name)
  tags        = ["ag-extension-dashboard-backend:latest"]
  cache-from  = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:backend"]
  cache-to    = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:backend,mode=max"]
}

target "frontend" {
  context     = "../"
  dockerfile  = "ag-extension-dashboard/src/frontend/Dockerfile"
  tags        = ["ag-extension-dashboard-frontend:latest"]
  cache-from  = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:frontend"]
  cache-to    = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:frontend,mode=max"]
}

target "agent-zero" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.agent-zero"
  tags        = ["ag-extension-dashboard-agent-zero:latest"]
  cache-from  = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:agent-zero"]
  cache-to    = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:agent-zero,mode=max"]
}

target "crew-ai" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.crew-ai"
  tags        = ["ag-extension-dashboard-crew-ai:latest"]
  cache-from  = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:crew-ai"]
  cache-to    = ["type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:crew-ai,mode=max"]
}

