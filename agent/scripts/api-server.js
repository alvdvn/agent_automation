// Figma Agent API Server v3
// Receives webhook calls from n8n and triggers Cursor IDE to generate Flutter code

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/figma_output';
const POLL_URL = process.env.CURSOR_POLL_URL || '';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// In-memory queue
const requestQueue = [];
let requestId = 0;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      queue_length: requestQueue.length
    }));
    return;
  }

  // === MAIN ENDPOINT: Receive webhook from n8n ===
  if (req.url === '/api/agent/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { message, figmaUrl, fileKey, nodeId } = data;
        
        // Extract Figma URL from message if not provided directly
        let finalFigmaUrl = figmaUrl;
        if (!finalFigmaUrl && message) {
          const urlMatch = message.match(/https?:\/\/[^\s]+figma\.com[^\s]*/);
          if (urlMatch) {
            finalFigmaUrl = urlMatch[0];
          }
        }
        
        const request = {
          id: ++requestId,
          figmaUrl: finalFigmaUrl,
          fileKey: fileKey || extractFileKey(finalFigmaUrl),
          nodeId: nodeId || extractNodeId(finalFigmaUrl),
          message,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        console.log('╔══════════════════════════════════════════╗');
        console.log('║         NEW FIGMA REQUEST RECEIVED        ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ ID:', request.id);
        console.log('║ Figma URL:', request.figmaUrl);
        console.log('║ File Key:', request.fileKey);
        console.log('║ Node ID:', request.nodeId);
        console.log('╚══════════════════════════════════════════╝');
        
        // Save request to file (for Cursor IDE to read)
        const requestFile = path.join(OUTPUT_DIR, `request_${request.id}.json`);
        fs.writeFileSync(requestFile, JSON.stringify(request, null, 2));
        
        // Also add to queue
        requestQueue.push(request);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          request_id: request.id,
          status: 'queued',
          figma_url: request.figmaUrl,
          instructions: 'Check /api/agent/next to get pending requests'
        }));
        
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // === POLL: Cursor IDE calls this to get next pending request ===
  if (req.url === '/api/agent/next' && req.method === 'GET') {
    const request = requestQueue.shift();
    
    if (request) {
      request.status = 'processing';
      request.startedAt = new Date().toISOString();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(request));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'no_pending_requests' }));
    }
    return;
  }

  // === COMPLETE: Cursor IDE calls this after generating code ===
  if (req.url.startsWith('/api/agent/complete/') && req.method === 'POST') {
    const reqId = req.url.split('/').pop();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const result = JSON.parse(body);
        
        console.log('╔══════════════════════════════════════════╗');
        console.log('║      CODE GENERATION COMPLETED!          ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log('║ Request ID:', reqId);
        console.log('║ Files:', result.files?.length || 0);
        console.log('║ Output:', result.outputDir || 'N/A');
        console.log('╚══════════════════════════════════════════╝');
        
        // Save result
        const resultFile = path.join(OUTPUT_DIR, `result_${reqId}.json`);
        fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // === QUEUE STATUS ===
  if (req.url === '/api/queue/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pending: requestQueue.length,
      status: 'ready'
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

function extractFileKey(url) {
  if (!url) return null;
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function extractNodeId(url) {
  if (!url) return null;
  const match = url.match(/node-id=([^&\s]+)/);
  return match ? match[1].replace(/-/g, ':') : null;
}

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   FIGMA AGENT API SERVER v3 STARTED     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║ Port: ${PORT}`);
  console.log(`║ Output: ${OUTPUT_DIR}`);
  console.log(`║ Endpoints:`);
  console.log(`║   POST /api/agent/generate`);
  console.log(`║   GET  /api/agent/next`);
  console.log(`║   POST /api/agent/complete/{id}`);
  console.log(`║   GET  /api/queue/status`);
  console.log('╚══════════════════════════════════════════╝');
});
