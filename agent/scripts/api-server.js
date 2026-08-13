// Figma Agent API Server
// Receives webhook calls from n8n and processes Figma design requests

const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;
const AGENT_SDK_TOKEN = process.env.CURSOR_SDK_TOKEN || '';
const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-opus-4';

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.url === '/api/agent/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message, context } = JSON.parse(body);
        console.log('Received request:', { message, context });

        // Process the request
        const result = await processAgentRequest(message, context);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Error processing request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message, status: 'error' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function processAgentRequest(message, context) {
  // This is where you would integrate with Cursor SDK
  // For now, return a structured response

  if (AGENT_SDK_TOKEN) {
    // Use Cursor Cloud Agent API
    return await callCursorCloudAgent(message, context);
  }

  // Return instructions for manual processing
  return {
    status: 'ready',
    message: 'Agent API server is running. Use Cursor IDE to process Figma designs.',
    instructions: [
      '1. Copy the Figma file URL from the webhook payload',
      '2. Open Cursor IDE',
      '3. Enable Figma MCP tools',
      '4. Paste the Figma URL',
      '5. Ask Agent to generate Flutter code'
    ],
    received_context: context
  };
}

async function callCursorCloudAgent(message, context) {
  // Integration with Cursor Cloud Agent
  const response = await fetch('https://api.cursor.com/v1/agent/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_SDK_TOKEN}`
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      message,
      context: {
        ...context,
        project_type: 'flutter',
        output_directory: 'figma_to_flutter/lib/generated'
      }
    })
  });

  return await response.json();
}

server.listen(PORT, () => {
  console.log(`Figma Agent API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Agent endpoint: http://localhost:${PORT}/api/agent/generate`);
});
