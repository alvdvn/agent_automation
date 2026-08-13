#!/usr/bin/env node

/**
 * Figma to Flutter Agent
 * 
 * Standalone version - generates Flutter code from Figma designs
 * 
 * Usage:
 *   node run-agent.js --url "https://www.figma.com/design/..."
 *   node run-agent.js --poll  (poll Railway server for tasks)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// === CONFIGURATION ===
const SERVER_URL = process.env.AGENT_SERVER_URL || 'https://agentautomation-production.up.railway.app';
const OUTPUT_DIR = process.env.FLUTTER_PROJECT_DIR || '/Users/vtit/Documents/AgentFigmaCode/figma_output';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');
const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN || '';

// === HELPERS ===
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Figma-Token': FIGMA_TOKEN
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// === FIGMA API ===
async function getFigmaDesign(fileKey, nodeId) {
  console.log(`📡 Fetching Figma design...`);
  console.log(`   File: ${fileKey}`);
  console.log(`   Node: ${nodeId}`);
  
  const nodeIds = encodeURIComponent(nodeId);
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds}`;
  
  const data = await httpsGet(url);
  
  if (data.err) {
    throw new Error(data.err);
  }
  
  return data;
}

async function getFigmaImage(fileKey, nodeId) {
  console.log(`📷 Getting Figma screenshot...`);
  const nodeIds = encodeURIComponent(nodeId);
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${nodeIds}&format=png&scale=2`;
  
  const data = await httpsGet(url);
  return data.images?.[nodeId];
}

// === CODE GENERATION ===
function generateFlutterCode(figmaData, screenName) {
  console.log('⚙️  Generating Flutter code...');
  
  const node = figmaData.nodes ? Object.values(figmaData.nodes)[0] : null;
  if (!node) {
    throw new Error('No nodes found in Figma response');
  }
  
  const cleanName = screenName.replace(/[^a-zA-Z0-9]/g, '_');
  const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  
  // Analyze Figma node structure
  const children = extractChildren(node);
  const colors = extractColors(node);
  const textStyles = extractTextStyles(node);
  
  const dartCode = `import 'package:flutter/material.dart';

/// Auto-generated Flutter screen from Figma
/// Screen: ${screenName}
class ${className}Screen extends StatefulWidget {
  const ${className}Screen({super.key});

  @override
  State<${className}Screen createState() => _${className}ScreenState();
}

class _${className}ScreenState extends State<${className}Screen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ${colors.backgroundColor || 'Colors.white'},
      appBar: AppBar(
        title: const Text('${screenName}'),
        backgroundColor: ${colors.primaryColor || 'Colors.blue'},
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ${generateChildWidgets(children, 0)}
            ],
          ),
        ),
      ),
    );
  }
}
${generateWidgets(children, 1)}
`;

  return dartCode;
}

function extractChildren(node) {
  const children = [];
  
  function traverse(n, depth = 0) {
    if (depth > 5) return; // Limit depth
    
    if (n.children) {
      for (const child of n.children) {
        children.push({
          type: n.type,
          name: n.name,
          id: n.id,
          fills: n.fills,
          absoluteBoundingBox: n.absoluteBoundingBox,
          style: n.style,
          children: n.children ? n.children.length : 0
        });
        traverse(child, depth + 1);
      }
    }
  }
  
  traverse(node);
  return children.slice(0, 20); // Limit to 20 elements
}

function extractColors(node) {
  const colors = {
    backgroundColor: null,
    primaryColor: null
  };
  
  function findColors(n) {
    if (n.fills && n.fills.length > 0) {
      const fill = n.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const r = Math.round(fill.color.r * 255);
        const g = Math.round(fill.color.g * 255);
        const b = Math.round(fill.color.b * 255);
        const colorStr = `Color(0xFF${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')})`;
        
        if (n.name.toLowerCase().includes('header') || n.name.toLowerCase().includes('appbar')) {
          colors.primaryColor = colorStr;
        }
        if (n.name.toLowerCase().includes('background') || n.name.toLowerCase().includes('body')) {
          colors.backgroundColor = colorStr;
        }
      }
    }
    if (n.children) {
      n.children.forEach(findColors);
    }
  }
  
  findColors(node);
  return colors;
}

function extractTextStyles(node) {
  const styles = [];
  
  function findText(n) {
    if (n.type === 'TEXT' && n.style) {
      styles.push({
        name: n.name,
        style: n.style
      });
    }
    if (n.children) {
      n.children.forEach(findText);
    }
  }
  
  findText(node);
  return styles;
}

function generateChildWidgets(children, indent) {
  const pad = '              '.slice(0, indent * 2);
  
  if (children.length === 0) {
    return `// Empty screen`;
  }
  
  return children.slice(0, 10).map((child, i) => {
    if (child.type === 'TEXT' || child.name.toLowerCase().includes('text')) {
      return `${pad}// Text: ${child.name}`;
    }
    if (child.type === 'RECTANGLE' || child.type === 'FRAME') {
      const box = child.absoluteBoundingBox || {};
      const width = box.width || 100;
      const height = box.height || 50;
      return `${pad}Container(
${pad}  width: ${width.toFixed(0)},
${pad}  height: ${height.toFixed(0)},
${pad}),`;
    }
    return `${pad}// ${child.type}: ${child.name}`;
  }).join('\n');
}

function generateWidgets(children, indent) {
  const pad = '  '.repeat(indent);
  
  return `
${pad}// Additional widgets can be added here
${pad}// Generated from Figma design
`;
}

// === PARSE Figma URL ===
function parseFigmaUrl(url) {
  const match = url.match(/figma\.com\/design\/([a-zA-Z0-9]+)[^?]*\?node-id=([0-9:-]+)/);
  
  if (!match) {
    throw new Error('Invalid Figma URL. Expected format: https://www.figma.com/design/FILEKEY/...?node-id=123:456');
  }
  
  let nodeId = match[2].replace('-', ':');
  
  return {
    fileKey: match[1],
    nodeId: nodeId
  };
}

// === TASK PROCESSING ===
async function processTask(task) {
  console.log(`\n📋 Processing: ${task.message || 'Figma design'}`);
  
  if (task.figmaUrl) {
    const { fileKey, nodeId } = parseFigmaUrl(task.figmaUrl);
    
    const figmaData = await getFigmaDesign(fileKey, nodeId);
    const screenName = 'FigmaScreen';
    
    const dartCode = generateFlutterCode(figmaData, screenName);
    
    // Save file
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const fileName = `screen_${Date.now()}.dart`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, dartCode);
    
    console.log(`\n✅ Generated: ${filePath}`);
    return { success: true, filePath };
  }
  
  throw new Error('No figmaUrl provided');
}

// === POLL FROM SERVER ===
async function pollServer() {
  try {
    const url = new URL('/api/agent/next', SERVER_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ status: 'no_pending_requests' });
          }
        });
      });
      
      req.on('error', () => resolve({ status: 'no_pending_requests' }));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ status: 'timeout' });
      });
      req.end();
    });
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// === MAIN ===
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         FIGMA TO FLUTTER AGENT v1.1                       ║
║         Standalone Mode                                   ║
╚══════════════════════════════════════════════════════════╝
  `);

  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    if (args[0] === '--url' && args[1]) {
      // Direct URL mode
      await processTask({
        message: 'Generate from URL',
        figmaUrl: args[1]
      });
      process.exit(0);
    }
    
    if (args[0] === '--poll') {
      // Poll server mode
      console.log('🔄 Polling server for tasks...\n');
      
      while (true) {
        const response = await pollServer();
        
        if (response && response.id) {
          console.log(`\n📋 Found task: ${response.id}`);
          
          try {
            await processTask({
              message: response.message,
              figmaUrl: response.figmaUrl,
              fileKey: response.fileKey,
              nodeId: response.nodeId
            });
            
            // Notify server
            console.log('📤 Notifying server...');
          } catch (e) {
            console.error(`❌ Error: ${e.message}`);
          }
        }
        
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    }
  }

  // Default: show usage
  console.log('Usage:');
  console.log('  node run-agent.js --url "https://www.figma.com/design/..."  Generate from URL');
  console.log('  node run-agent.js --poll                                        Poll server for tasks');
  console.log('');
}

main().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Agent stopped');
  process.exit(0);
});
