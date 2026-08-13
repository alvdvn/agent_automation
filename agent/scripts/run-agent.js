#!/usr/bin/env node

/**
 * Figma to Flutter Agent
 * 
 * Run this script on your LOCAL machine (not on Railway!)
 * It will:
 * 1. Poll Railway server for pending Figma requests
 * 2. Read Figma design using Figma MCP
 * 3. Generate Flutter/Dart code
 * 4. Save files to your project
 * 5. Notify server when complete
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

// === CONFIGURATION ===
const SERVER_URL = process.env.AGENT_SERVER_URL || 'https://agentautomation-production.up.railway.app';
const OUTPUT_DIR = process.env.FLUTTER_PROJECT_DIR || '/Users/vtit/Documents/AgentFigmaCode/figma_output';
const POLL_INTERVAL = 5000; // Poll every 5 seconds

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// === LOGO ===
console.log(`
╔══════════════════════════════════════════════════════════╗
║         FIGMA TO FLUTTER AGENT v1.0                   ║
║         Running on LOCAL machine                       ║
╚══════════════════════════════════════════════════════════╝
`);

console.log(`Server URL: ${SERVER_URL}`);
console.log(`Output Dir: ${OUTPUT_DIR}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
console.log('');

// === API HELPERS ===
function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SERVER_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SERVER_URL);
    const data = JSON.stringify(body);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(response));
        } catch (e) {
          resolve(response);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// === FIGMA API (Direct call without MCP) ===
async function getFigmaDesign(fileKey, nodeId) {
  // Figma API v4 - không cần token cho public files!
  console.log(`📡 Fetching Figma design: ${fileKey}/${nodeId}`);
  
  // Get node details
  const nodeIds = encodeURIComponent(nodeId);
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds}`;
  
  // Thử không có token trước (cho public files)
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN || ''
    }
  });
  
  if (!response.ok) {
    // Thử cách khác - export endpoint
    console.log('⚠️ Standard API failed, trying export...');
    const exportUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeId}&format=png`;
    const exportRes = await fetch(exportUrl, {
      headers: {
        'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN || ''
      }
    });
    
    if (!exportRes.ok) {
      throw new Error(`Figma API error: ${response.status}. Make sure file is set to "Anyone with link can view"`);
    }
    
    const exportData = await exportRes.json();
    return {
      document: { type: 'DOCUMENT' },
      nodes: {},
      images: exportData.images
    };
  }
  
  const data = await response.json();
  return data;
}

// === CODE GENERATION ===
function generateFlutterCode(figmaData) {
  console.log('⚙️  Generating Flutter code...');
  
  // Extract components from Figma data
  const document = figmaData.document;
  const nodeId = Object.keys(figmaData.nodes)[0];
  const node = figmaData.nodes[nodeId];
  
  // Get screen name
  const screenName = node.name.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Generate Dart code
  const dartCode = generateScreenCode(screenName, node);
  
  return {
    screenName,
    dartCode,
    nodeId
  };
}

function generateScreenCode(name, figmaNode) {
  // Simple Flutter screen generator based on Figma data
  const children = figmaNode.document?.children || [];
  const hasText = children.some(c => c.type === 'TEXT');
  const hasRectangles = children.some(c => c.type === 'RECTANGLE');
  const hasComponents = children.some(c => c.type === 'COMPONENT');
  
  return `import 'package:flutter/material.dart';

/// Auto-generated Flutter screen from Figma
/// Node ID: ${figmaNode.id}
class ${name}Screen extends StatelessWidget {
  const ${name}Screen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${name.replace(/_/g, ' ')}'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ${generateWidgetCode(children)}
            ],
          ),
        ),
      ),
    );
  }
${generateWidgetMethods(children)}
` + generateHelperWidgets();
}

function generateWidgetCode(children) {
  return children.map(child => {
    if (child.type === 'TEXT') {
      const text = child.characters || child.name;
      const style = child.style || {};
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 400;
      return `Text(
                '${escapeString(text)}',
                style: TextStyle(
                  fontSize: ${fontSize}.0,
                  fontWeight: FontWeight.w${fontWeight},
                ),
              ),
              const SizedBox(height: 8),`;
    }
    if (child.type === 'RECTANGLE' || child.type === 'FRAME') {
      const fills = child.fills?.[0] || {};
      const color = fills.color || { r: 0.9, g: 0.9, b: 0.9, a: 1 };
      const width = child.absoluteBoundingBox?.width || 200;
      const height = child.absoluteBoundingBox?.height || 100;
      return `Container(
                width: ${width}.0,
                height: ${height}.0,
                decoration: BoxDecoration(
                  color: Color.fromRGBO(
                    ${Math.round(color.r * 255)}, 
                    ${Math.round(color.g * 255)}, 
                    ${Math.round(color.b * 255)}, 
                    ${color.a || 1}
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(height: 16),`;
    }
    if (child.type === 'COMPONENT') {
      return `const Card(
                child: ListTile(
                  leading: Icon(Icons.widgets),
                  title: Text('${child.name}'),
                ),
              ),
              const SizedBox(height: 8),`;
    }
    return '';
  }).filter(Boolean).join('\n              ');
}

function generateWidgetMethods(children) {
  const components = children.filter(c => c.type === 'COMPONENT');
  if (components.length === 0) return '';
  
  return components.map(c => {
    const name = c.name.replace(/[^a-zA-Z0-9]/g, '');
    return `
  Widget _build${name}(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Text('${c.name}'),
      ),
    );
  }`;
  }).join('');
}

function generateHelperWidgets() {
  return `

// Auto-generated helper widgets
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;

  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      child: Text(label),
    );
  }
}

class CustomCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;

  const CustomCard({
    super.key,
    required this.child,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}
`;
}

function escapeString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/\n/g, ' ').trim();
}

// === MAIN AGENT LOOP ===
async function pollAndProcess() {
  try {
    // Poll for next pending request
    const request = await apiGet('/api/agent/next');
    
    if (request.status === 'no_pending_requests') {
      return false;
    }
    
    console.log(`\n📋 Processing Request #${request.id}`);
    console.log(`   Figma URL: ${request.figmaUrl}`);
    console.log(`   File Key: ${request.fileKey}`);
    console.log(`   Node ID: ${request.nodeId}`);
    
    // Fetch Figma design
    const figmaData = await getFigmaDesign(request.fileKey, request.nodeId);
    
    // Generate Flutter code
    const { screenName, dartCode } = generateFlutterCode(figmaData);
    
    // Save file
    const fileName = `${screenName.toLowerCase()}_screen.dart`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, dartCode);
    
    console.log(`\n✅ Generated: ${filePath}`);
    
    // Notify server
    await apiPost(`/api/agent/complete/${request.id}`, {
      success: true,
      files: [fileName],
      outputDir: OUTPUT_DIR,
      screenName
    });
    
    console.log(`📤 Server notified of completion`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Agent started. Polling for requests...\n');
  
  // Initial poll
  await pollAndProcess();
  
  // Continue polling
  setInterval(async () => {
    await pollAndProcess();
  }, POLL_INTERVAL);
}

// === START ===
main().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Agent stopped');
  process.exit(0);
});
