pipeline {
    agent any
    options {
        // Parallel runs race the --force-recreate deploy and can interleave
        // `down`/`up` from two builds on the same host.
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }
    environment {
        PROJECT_DIR = 'ag-extension-dashboard'
        COMPOSE_PROJECT_NAME = 'ag-extension'
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Setup') {
            steps {
                sh "docker network create ag-network || true"
                // Stop containers only. NEVER pass `-v` here: it deletes the Postgres,
                // Redis and agent data volumes on every pipeline run. Stale frontend
                // assets are handled by `--build --force-recreate` in the Deploy stage.
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml down --remove-orphans || true"
            }
        }
        stage('Validate Compose') {
            steps {
                // Validate compose syntax WITHOUT printing the resolved config:
                // `docker compose config` inlines every secret (DATABASE_PASSWORD,
                // JWT_SECRET, provider API keys) and `cat`-ing it to the build log
                // gave read-access users the full credential set.
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml config --quiet"
            }
        }
        stage('Test') {
            steps {
                // Tests and typechecks gate the deploy — a failure here must fail the build.
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml run --rm --no-deps backend npm test -- --forceExit 2>&1"
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml run --rm --no-deps backend npx tsc --noEmit 2>&1"
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml run --rm --no-deps frontend npm run typecheck 2>&1"
            }
        }
        stage('Deploy') {
            steps {
                // Force a fresh build without cache to ensure the new frontend logic is compiled
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml up -d --build --force-recreate > compose-deploy.log 2>&1"
            }
        }
        stage('Verify') {
            steps {
                sh "sleep 5"
                sh 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-'
                // Real smoke gate: the backend must actually answer /health,
                // not merely appear in `docker ps` output. Node's native fetch
                // is used (per deployment rules — curl may not exist in slim
                // base images). Retries cover the app's 60s health warmup.
                sh "node scripts/smoke-probe.cjs 90 http://127.0.0.1:7500/health"
            }
        }
