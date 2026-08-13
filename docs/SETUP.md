# Figma MCP + Agent + n8n Setup Guide

## Prerequisites

1. **Cursor IDE** with Figma MCP configured
2. **Figma Account** with access token
3. **n8n** (Cloud or Self-hosted)
4. **Flutter SDK** (already installed)

---

## Step 1: Configure Figma MCP in Cursor

### 1.1 Get Figma Access Token
1. Go to [Figma Settings > Personal Access Tokens](https://www.figma.com/developers/api#access-tokens)
2. Create a new token with appropriate permissions
3. Copy the token

### 1.2 Configure Cursor MCP Settings
Add to your Cursor MCP configuration (`~/.cursor/mcp.json` or via Settings):

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-figma"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "your-figma-access-token"
      }
    }
  }
}
```

Or use the Figma MCP from the catalog:
```json
{
  "mcpServers": {
    "user-figma": {
      "command": "uvx",
      "args": ["mcp-server-figma"]
    }
  }
}
```

---

## Step 2: Setup n8n

### Option A: n8n Cloud
1. Create account at [n8n.io](https://n8n.io)
2. Create new workflow

### Option B: n8n Self-hosted
```bash
# Using Docker
docker run -d --name n8n -p 5678:5678 n8nio/n8n

# Or using npm
npm install -g n8n
n8n start
```

### 2.1 Import Workflow
Import `n8n/workflows/figma-trigger.json` into n8n.

### 2.2 Configure Webhook
1. n8n will provide a webhook URL
2. Add this URL to Figma as a webhook:
   - Go to Figma file > Settings > Webhooks
   - Add webhook URL
   - Subscribe to "FILE_UPDATE" events

### 2.3 Webhook URL Format
```
https://your-n8n-instance/webhook/figma-trigger
```

---

## Step 3: Setup Flutter Project

```bash
cd figma_to_flutter
flutter pub get
```

The project is pre-configured and ready to receive generated code.

---

## Step 4: Agent Prompt Template

Use the prompt in `agent/prompts/figma-to-flutter-system-prompt.md` as your system prompt in Cursor.

---

## Workflow: Automated Code Generation

### Flow Diagram

```
1. Designer updates Figma file
         ↓
2. Figma sends webhook to n8n
         ↓
3. n8n validates and formats request
         ↓
4. n8n calls Cursor Agent API
         ↓
5. Agent reads Figma via MCP
         ↓
6. Agent generates Flutter code
         ↓
7. Code pushed to repository
         ↓
8. CI/CD triggers build (optional)
```

### Manual Trigger (via Cursor)

1. Open Cursor IDE
2. Set Figma MCP as active
3. Paste Figma URL
4. Ask Agent: "Generate Flutter code for this design"
5. Agent will use MCP to read design
6. Review and apply generated code

---

## Troubleshooting

### MCP Not Working
- Verify Figma token is valid
- Check MCP server is running: `cursor mcp list`
- Restart Cursor if needed

### n8n Webhook Issues
- Ensure webhook URL is publicly accessible
- Check n8n logs for errors
- Verify Figma webhook is active

### Code Generation Issues
- Provide more context in prompts
- Check agent has access to Flutter project
- Review generated code for errors
