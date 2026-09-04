variable "GITHUB_REPOSITORY" {
  default = "psalmprax/ag_extension_decision_support"
}

group "default" {
  targets = ["backend", "frontend", "agent-zero", "crew-ai", "discovery-scraper"]
}

target "backend" {
  context     = "../"
  dockerfile  = "ag-extension-dashboard/src/backend/Dockerfile"
  target      = "production"
  # Tag matches docker-compose's internal naming: <project>-<service>
  # COMPOSE_PROJECT_NAME is "ag-extension-dashboard" (from directory name)
  tags        = ["ag-extension-dashboard-backend:latest"]
  cache-from  = ["type=local,src=/root/docker-cache/backend", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:backend"]
  cache-to    = ["type=local,dest=/root/docker-cache/backend,mode=max"]
}

target "frontend" {
  context     = "../"
  dockerfile  = "ag-extension-dashboard/src/frontend/Dockerfile"
  tags        = ["ag-extension-dashboard-frontend:latest"]
  cache-from  = ["type=local,src=/root/docker-cache/frontend", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:frontend"]
  cache-to    = ["type=local,dest=/root/docker-cache/frontend,mode=max"]
}

target "agent-zero" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.agent-zero"
  tags        = ["ag-extension-dashboard-agent-zero:latest"]
  cache-from  = ["type=local,src=/root/docker-cache/agent-zero", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:agent-zero"]
  cache-to    = ["type=local,dest=/root/docker-cache/agent-zero,mode=max"]
}

target "crew-ai" {
  context     = "./src/agents"
  dockerfile  = "Dockerfile.crew-ai"
  tags        = ["ag-extension-dashboard-crew-ai:latest"]
  cache-from  = ["type=local,src=/root/docker-cache/crew-ai", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:crew-ai"]
  cache-to    = ["type=local,dest=/root/docker-cache/crew-ai,mode=max"]
}

target "discovery-scraper" {
  context     = "./src/agents/tools/cloakbrowser"
  dockerfile  = "Dockerfile.discovery-scraper"
  tags        = ["ag-extension-dashboard-discovery-scraper:latest"]
  cache-from  = ["type=local,src=/root/docker-cache/discovery-scraper", "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY}/buildcache:discovery-scraper"]
  cache-to    = ["type=local,dest=/root/docker-cache/discovery-scraper,mode=max"]
}

