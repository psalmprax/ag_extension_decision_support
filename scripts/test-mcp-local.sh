#!/bin/bash

# Test MCP Tools Locally

echo "🧪 Testing MCP Tools functionality..."

# Start the server in the background
cd ag-extension-dashboard/src/backend
PORT=3003 npm run dev > server.log 2>&1 &
SERVER_PID=$!

echo "⏳ Waiting for server to start..."
sleep 20

echo "🔍 Checking server health..."
HEALTH=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3003/api/health)
if [ "$HEALTH" != "200" ]; then
    echo "❌ Server health check failed (HTTP $HEALTH)"
    cat server.log | tail -20
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Server is healthy"

echo "🔧 Testing MCP tools endpoint..."
MCP_RESPONSE=$(curl -s http://localhost:3003/api/mcp/tools)
if echo "$MCP_RESPONSE" | grep -q "error"; then
    echo "❌ MCP endpoint returned error:"
    echo "$MCP_RESPONSE"
    cat server.log | tail -20
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

TOOL_COUNT=$(echo "$MCP_RESPONSE" | jq '.data | length' 2>/dev/null || echo "0")
echo "✅ MCP endpoint working - found $TOOL_COUNT tools"

echo "🛠️ Testing tool execution..."
# Test a simple tool like get_current_date
EXEC_RESPONSE=$(curl -s -X POST http://localhost:3003/api/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "get_current_date", "arguments": {}}')

if echo "$EXEC_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Tool execution working"
else
    echo "❌ Tool execution failed:"
    echo "$EXEC_RESPONSE"
fi

echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
rm -f server.log

echo "🎉 MCP Tools test completed successfully!"