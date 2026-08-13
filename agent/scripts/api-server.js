// Figma Agent API Server v2
// Receives webhook calls from n8n and processes Figma design requests

const http = require('http');
const { spawn } = require('child_process');
const Redis = require('ioredis');

const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;

// Try to connect to Redis
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, retryDelayOnFailover: 100 });
  redis.on('error', (err) => console.log('Redis not available, using in-memory store'));
} catch (e) {
  console.log('Redis not available, using in-memory store');
}

// In-memory queue as fallback
const requestQueue = [];
let requestId = 0;

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
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      queue_length: requestQueue.length
    }));
    return;
  }

  if (req.url === '/api/agent/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { message, context, figmaUrl, fileKey, nodeId } = data;
        
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
          context,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        console.log('=== NEW REQUEST ===');
        console.log('ID:', request.id);
        console.log('Figma URL:', request.figmaUrl);
        console.log('File Key:', request.fileKey);
        console.log('Node ID:', request.nodeId);
        console.log('====================');
        
        // Store in queue
        if (redis) {
          await redis.lpush('figma_requests', JSON.stringify(request));
        } else {
          requestQueue.push(request);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          request_id: request.id,
          status: 'queued',
          figma_url: request.figmaUrl,
          message: 'Request queued. Use /api/agent/next to get pending request.'
        }));
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message, status: 'error' }));
      }
    });
    return;
  }

  // Get next pending request (for Cursor Agent to poll)
  if (req.url === '/api/agent/next' && req.method === 'GET') {
    let request = null;
    
    if (redis) {
      const data = await redis.rpop('figma_requests');
      if (data) {
        request = JSON.parse(data);
      }
    } else {
      request = requestQueue.shift();
    }
    
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

  // Complete a request with generated code
  if (req.url.startsWith('/api/agent/complete/') && req.method === 'POST') {
    const requestId = req.url.split('/').pop();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const result = JSON.parse(body);
        
        console.log('=== REQUEST COMPLETED ===');
        console.log('ID:', requestId);
        console.log('Files generated:', result.files?.length || 0);
        console.log('========================');
        
        // Store completed result
        const completedData = {
          requestId,
          ...result,
          completedAt: new Date().toISOString()
        };
        
        if (redis) {
          await redis.lpush('figma_completed', JSON.stringify(completedData));
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: completedData }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Get queue status
  if (req.url === '/api/queue/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      pending: requestQueue.length,
      status: 'ready'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
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
  console.log(`Figma Agent API Server v2 running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Agent endpoint: http://localhost:${PORT}/api/agent/generate`);
  console.log(`Poll endpoint: http://localhost:${PORT}/api/agent/next`);
});
