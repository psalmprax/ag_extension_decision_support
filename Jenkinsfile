// CI/CD for ag_extension_decision_support
pipeline {
    agent any

    environment {
        PROJECT_DIR = "ag-extension-dashboard"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Backend Dependencies') {
            steps {
                dir("${PROJECT_DIR}/src/backend") {
                    sh 'npm install'
                }
            }
        }

        stage('Build Backend') {
            steps {
                dir("${PROJECT_DIR}/src/backend") {
                    sh 'npm run build'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir("${PROJECT_DIR}/src/frontend") {
                    sh 'npm install'
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir("${PROJECT_DIR}/src/frontend") {
                    sh 'npm run build'
                }
            }
        }
    }
}
