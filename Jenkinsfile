pipeline {
    agent any

    environment {
        // IDs for Jenkins Credentials Manager
        SSH_CRED_ID = 'ssh-deploy-key'
        GIT_CRED_ID = 'git-creds'
        
        // Remote server details (Provide these as Jenkins Build Parameters or hardcode here)
        REMOTE_USER = 'psalmprax'
        REMOTE_HOST = 'your-remote-server-ip'
        DEPLOY_DIR = '/home/psalmprax/ag-extension-decision-support'
        
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
                    sh 'npm install'
                    sh 'npm run lint'
                    sh 'npm run test'
                }
            }
        }

        stage('Frontend CI') {
            steps {
                dir('ag-extension-dashboard/src/frontend') {
                    sh 'npm install'
                    sh 'npm run lint'
                    sh 'npm run test'
                }
            }
        }

        stage('Docker Build') {
            steps {
                dir('ag-extension-dashboard') {
                    sh 'docker compose build'
                }
            }
        }

        stage('Deploy to Remote') {
            steps {
                sshagent([SSH_CRED_ID]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} 'mkdir -p ${DEPLOY_DIR}'
                        scp -o StrictHostKeyChecking=no ag-extension-dashboard/docker-compose.yml ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
                        scp -o StrictHostKeyChecking=no ag-extension-dashboard/docker-compose.agents.yml ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
                        
                        # Copy backend production files if needed, or pull images if using registry
                        # For this example, we assume we might need to build on remote or sync source if not using registry
                        # rsync -avz --exclude 'node_modules' ag-extension-dashboard/ ${REMOTE_USER}@${REMOTE_HOST}:${DEPLOY_DIR}/
                        
                        ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST} 'cd ${DEPLOY_DIR} && docker compose -f docker-compose.yml -f docker-compose.agents.yml up -d --build'
                    """
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
