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
        stage('Cleanup Previous Deployment') {
            steps {
                // Ensure the previous deployment is removed to avoid conflicts
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml down --remove-orphans || true"
            }
        }
        stage('Deploy All Stacks') {
            steps {
                // Deploying Main Dashboard, Backend, DB, Redis and AI Agents
                // Using -p flag specifically to ensure consistent project naming
                sh "docker-compose -p ${COMPOSE_PROJECT_NAME} -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml up -d --build"
            }
        }
        stage('Verify Deployment') {
            steps {
                // Wait a few seconds for services to stabilize
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
