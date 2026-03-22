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
        stage('Setup Environment') {
            steps {
                // Ensure the external network exists
                sh "docker network create ag-network || true"
                // Cleanup any orphans from other projects that might conflict with container names
                sh "docker stop ag-dashboard-frontend ag-dashboard-backend ag-dashboard-db ag-dashboard-redis ag-agent-zero ag-crew-ai || true"
                sh "docker rm ag-dashboard-frontend ag-dashboard-backend ag-dashboard-db ag-dashboard-redis ag-agent-zero ag-crew-ai || true"
            }
        }
        stage('Deploy Application Stack') {
            steps {
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml up -d --build"
            }
        }
        stage('Deploy AI Agents') {
            steps {
                // Combining both files ensures they share the same project context and network
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml up -d --build"
            }
        }
        stage('Verify Deployment') {
            steps {
                sh "sleep 10"
                sh 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ag-'
            }
        }
    }
    post {
        always {
            echo "Deployment cycle finished."
        }
    }
}
