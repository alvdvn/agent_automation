# Figma to Flutter - Agent Automation

## Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Figma     │───▶│  Figma MCP  │───▶│   Agent     │───▶│   Flutter   │
│  (Design)   │    │  (Cursor)   │    │  (Cursor)   │    │   Project   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                   ┌──────┴──────┐
                   │     n8n     │
                   │(Webhook +   │
                   │Orchestrator)│
                   └─────────────┘
```

## Project Structure

```
AgentFigmaCode/
├── figma_to_flutter/          # Flutter project (code output)
│   └── lib/
│       └── generated/         # Auto-generated widgets
├── n8n/                       # n8n workflows
│   └── workflows/
│       └── figma-trigger.json
├── agent/                     # Agent configurations
│   ├── prompts/               # System prompts
│   └── scripts/              # Helper scripts
├── docs/                      # Documentation
└── README.md
```

## Components

### 1. Figma MCP
- Reads design context from Figma files
- Extracts components, styles, variables
- Generates screenshots

### 2. Cursor Agent
- Receives design context from MCP
- Generates Flutter widget code
- Follows project conventions

### 3. n8n Orchestrator
- Monitors Figma webhooks
- Triggers agent when designs change
- Manages workflow automation

## Setup Instructions

See [docs/SETUP.md](docs/SETUP.md) for detailed setup.
