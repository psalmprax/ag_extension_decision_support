#!/usr/bin/env bash

# Verify backend health
echo "Checking backend health..."
curl -sSf http://localhost:7500/health || { echo "Backend health check failed"; exit 1; }

echo "Backend is healthy"

# Verify frontend health (assuming it serves at http://localhost:5173)
echo "Checking frontend health..."
curl -sSf http://localhost:5173/ || { echo "Frontend health check failed"; exit 1; }

echo "Frontend is healthy"

echo "All services are healthy"
