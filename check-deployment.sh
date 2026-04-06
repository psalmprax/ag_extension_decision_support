#!/bin/bash

# Ag-Extension Deployment Health Check Script

echo "🔍 Checking Ag-Extension deployment health..."

# Base URL
BASE_URL="https://ag-extension-decision-support.onrender.com"

echo "📡 Testing basic connectivity..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "$BASE_URL/"

echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
echo "Health Response: $HEALTH_RESPONSE"

echo "🔧 Testing MCP tools endpoint..."
MCP_RESPONSE=$(curl -s "$BASE_URL/api/mcp/tools")
echo "MCP Tools Response: $MCP_RESPONSE"

echo "✨ Health check complete!"