#!/usr/bin/env bash
set -e
# Ensure the frontend container can reach the backend health endpoint
docker exec ag-dashboard-frontend curl -s http://backend:3001/health || { echo "Backend unreachable"; exit 1; }
echo "Frontend can reach backend"
