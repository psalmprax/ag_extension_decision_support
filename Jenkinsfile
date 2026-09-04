pipeline {
    agent any
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
        stage('Debug Config') {
            steps {
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml config > compose-config.txt 2>&1 || true"
                sh "cat compose-config.txt"
            }
        }
        stage('Test') {
            steps {
                // Tests and typechecks gate the deploy — a failure here must fail the build.
                sh "docker compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml run --rm --no-deps backend npm test -- --passWithNoTests 2>&1"
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
            }
        }
    }
    post {
        failure {
            sh "cat compose-deploy.log || echo 'No log file found'"
        }
    }
}
