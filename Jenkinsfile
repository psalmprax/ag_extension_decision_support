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
        stage('Deploy All Stacks') {
            steps {
                // Deploying Main Dashboard, Backend, DB, Redis and AI Agents
                // First Deploy Main Stack to create network and base services
                sh "docker-compose -f ${PROJECT_DIR}/docker-compose.yml up -d --build"
                // Then deploy AI Agents overlay
                sh "docker-compose -f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.agents.yml up -d --build"
            }
        }
        stage('Verify Deployment') {
            steps {
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
