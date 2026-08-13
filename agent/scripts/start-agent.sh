#!/bin/bash
# Start the agent - polls Railway for Figma requests and generates Flutter code

cd /Users/vtit/Documents/AgentFigmaCode/agent/scripts

# Optional: Set FIGMA_ACCESS_TOKEN if your files are private
# Get token from: https://www.figma.com/settings (Account → Personal access tokens)
# For FREE accounts: Make sure Figma files are set to "Anyone with link can view"
export FIGMA_ACCESS_TOKEN="${FIGMA_ACCESS_TOKEN:-}"

# Set server URL
export AGENT_SERVER_URL="${AGENT_SERVER_URL:-https://agentautomation-production.up.railway.app}"

# Set output directory
export FLUTTER_PROJECT_DIR="/Users/vtit/Documents/AgentFigmaCode/figma_output"

echo "============================================"
echo "  FIGMA TO FLUTTER AGENT"
echo "============================================"
echo "Server: $AGENT_SERVER_URL"
echo "Output: $FLUTTER_PROJECT_DIR"
echo ""
echo "✅ No token needed for public Figma files!"
echo "   For private files: set FIGMA_ACCESS_TOKEN"
echo ""

# Run the agent
node run-agent.js
