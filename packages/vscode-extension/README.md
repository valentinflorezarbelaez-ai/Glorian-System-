# EOS System — VS Code Extension

Brings the full EOS Engineering Operating System into VS Code and Cursor.

## Features

- **EOS: Consult** — Get a complete consulting deliverable (5-Whys, ADR, code, risk matrix) for any engineering problem
- **EOS: Spec Drift** — Detect code/spec drift — find modules missing specs or code newer than their spec
- **EOS: Context Window** — Assemble a token-budget context block for the active file using blast radius analysis
- **EOS: Start MCP Server** — Auto-start the EOS MCP server for Cursor/Claude Code integration

## Requirements

- EOS System project cloned locally
- Node.js 22+

## Installation

Install from VS Code Marketplace (coming soon) or clone the EOS repo and run:
```bash
cd packages/vscode-extension
npm install
npm run package
code --install-extension eos-system-vscode-53.0.0.vsix
```
