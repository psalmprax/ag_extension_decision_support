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
                sh "docker stop ag-dashboard-frontend ag-dashboard-backend ag-dashboard-db ag-dashboard-redis ag-agent-zero ag-crew-ai || true"
                sh "docker rm ag-dashboard-frontend ag-dashboard-backend ag-dashboard-db ag-dashboard-redis ag-agent-zero ag-crew-ai || true"
            }
        }
        stage('Debug Config') {
            steps {
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml config > compose-config.txt 2>&1 || true"
                sh "cat compose-config.txt"
            }
        }
        stage('Deploy') {
            steps {
                // Run with redirection to see errors clearly in console
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml up -d --build > compose-deploy.log 2>&1"
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
