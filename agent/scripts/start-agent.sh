#!/bin/bash

# Figma to Flutter - Agent API Server
# This script starts a simple API server that receives requests from n8n
# and triggers the Cursor Agent

set -e

# Configuration
PORT=${PORT:-8080}
HOST=${HOST:-0.0.0.0}

echo "========================================"
echo "Figma Agent API Server"
echo "========================================"
echo "Port: $PORT"
echo "Host: $HOST"
echo ""

# Check if using Cursor SDK or external API
if [ -n "$CURSOR_SDK_TOKEN" ]; then
    echo "Using Cursor Cloud Agent"
    echo "Token configured: ${CURSOR_SDK_TOKEN:0:10}..."
fi

# For now, print instructions for manual use
cat << 'EOF'

📋 HOW TO USE THIS SETUP:

1. START N8N
   - Go to n8n.io or run locally
   - Import the workflow: n8n/workflows/figma-trigger.json

2. CONFIGURE Figma WEBHOOK
   - In Figma: Settings > Webhooks
   - Add your n8n webhook URL
   - Subscribe to: file_update

3. START THIS API SERVER (Optional - for remote agents)
   - Run: node agent/scripts/api-server.js
   - Configure CURSOR_AGENT_URL and AGENT_API_KEY

4. USE WITH CURSOR
   - Open Cursor IDE
   - Enable Figma MCP
   - Paste Figma URL
   - Ask: "Generate Flutter code"

FOR LOCAL DEVELOPMENT:
----------------------
Simply use Cursor IDE directly:
1. Open Cursor
2. Enable Figma MCP tools
3. Paste Figma design URL
4. Ask Agent to generate code

EOF

# Start a simple health check server if needed
if command -v node &> /dev/null; then
    echo "Node.js available - you can run: node agent/scripts/api-server.js"
fi
