pipeline {
    agent any

    environment {
        // IDs for Jenkins Credentials Manager
        SSH_CRED_ID = 'OCI_SSH_KEY'
        GIT_CRED_ID = 'GITHUB_CREDENTIALS'
        
        // Remote server details (Provide these as Jenkins Build Parameters or hardcode here)
        REMOTE_USER = 'root'
        REMOTE_HOST = '172.21.0.1'
        DEPLOY_DIR = '/root/ag-extension-decision-support'
        
        // Docker registry (Optional)
        // DOCKER_REGISTRY = 'your-registry.com'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend CI') {
            steps {
                dir('ag-extension-dashboard/src/backend') {
                    sh 'docker build -t ag-backend-test --target development .'
                    sh 'docker run --rm ag-backend-test sh -c "npm run lint && npm run test"'
                }
            }
        }

        stage('Frontend CI') {
            steps {
                dir('ag-extension-dashboard/src/frontend') {
                    sh 'docker build -t ag-frontend-test --target development .'
                    sh 'docker run --rm ag-frontend-test sh -c "npm run lint && npm run test"'
                }
            }
        }

        stage('Docker Build') {
            steps {
                dir('ag-extension-dashboard') {
                    sh 'docker-compose build'
                }
            }
        }

        stage('Deploy to Remote') {
            steps {
                script {
                    echo "Deploying to Host via Docker Socket Orchestration..."
                    sh "mkdir -p ${DEPLOY_DIR}"
                    sh "cp -r ag-extension-dashboard/* ${DEPLOY_DIR}/"
                    // Trigger deployment on host using the host's env but triggered from here
                    sh "docker-compose -f ${DEPLOY_DIR}/docker-compose.yml -f ${DEPLOY_DIR}/docker-compose.agents.yml down || true"
                    sh "docker-compose -f ${DEPLOY_DIR}/docker-compose.yml -f ${DEPLOY_DIR}/docker-compose.agents.yml up -d --build"
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed. Check logs.'
        }
    }
}
