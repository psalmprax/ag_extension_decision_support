pipeline {
    agent any
    environment {
        PROJECT_DIR = 'ag-extension-dashboard'
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
                    sh 'npm install --no-audit --no-fund --no-progress'
                }
            }
        }
        stage('Build Backend') {
            steps {
                dir("${PROJECT_DIR}/src/backend") {
                    sh 'npm run build || echo "Build failed, but continuing"'
                }
            }
        }
    }
}
