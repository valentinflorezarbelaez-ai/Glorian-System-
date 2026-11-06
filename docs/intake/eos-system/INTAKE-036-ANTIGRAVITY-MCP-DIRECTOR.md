# INTAKE-036: SOVEREIGN ANTIGRAVITY MCP CONTROL PLANE & DIRECTOR MESH (v49.0.0)

## 1. Context & Executive Directive
- **Owner Directive**: Connect EOS as the authoritative Model Context Protocol (MCP) Control Plane and active Director in Google Antigravity so EOS governs, routes, audits, and verifies every engineering mission end-to-end across all workspaces.
- **Target System**: `eos-system` (`c:\Users\valen\Eos-System`) + Machine-Global Antigravity Customization Layer (`~/.gemini/config/`).
- **Date**: `2026-10-30`
- **Authorization Tier**: `LEVEL 3` (Explicit Owner Directive)

## 2. Reconnaissance Findings
1. **Dangling NTFS Junctions in `~/.gemini/config/`**:
   - `~/.gemini/config/plugins/eos-governance` pointed to the obsolete path `C:\Users\valen\Documents\Eos system\dist\eos-governance-plugin` (`EXISTS: false`).
   - `~/.gemini/config/skills` pointed to the obsolete path `C:\Users\valen\Documents\Eos system\.agents\skills` (`EXISTS: false`).
   - Consequence: Antigravity could not load EOS governance rules, EOS orchestration skills, or EOS lifecycle hooks.
2. **Incomplete Global MCP Environment Bindings**:
   - `~/.gemini/config/mcp_config.json` launched `src/mcp/eosMcpServer.ts` without `EOS_PROJECT_ROOT` or `EOS_FLEET_*_PATH` environment bindings (`EOS_FLEET_EOS_SYSTEM_PATH`, `EOS_FLEET_ABERAMENTHO_PATH`, `EOS_FLEET_PORTAFOLIO_PATH`, `EOS_FLEET_PTG_PATH`, `EOS_FLEET_CRUD_SLACK_PATH`).
3. **Passive MCP Protocol Surface**:
   - `EosMcpServer.handleRequest("initialize")` lacked protocol version negotiation (`2024-11-05` / `2025-03-26`), `instructions` playbook injection (which Antigravity materializes as `<appDataDir>/mcp/eos-system/instructions.md`), `ping` heartbeat support, `prompts/list` + `prompts/get` capabilities, and active mission-direction tools (`eos_antigravity_direct`, `eos_antigravity_doctor`).

## 3. Scope & Deliverables
1. **Layer-0 Antigravity Director Core (`src/core/eosAntigravityDirector.ts`)**: Pure zero-dependency mission classifier, External Write Barrier verifier, MCP tool DAG planner, config synthesizer, and Antigravity integration doctor with SHA-256 receipts.
2. **Enhanced MCP Server (`src/mcp/eosMcpServer.ts`)**: Protocol negotiation (`2024-11-05` / `2025-03-26`), `instructions` injection, `ping`, `prompts/list`, `prompts/get`, `eos://antigravity/director-playbook` resource, and tools `eos_antigravity_direct` & `eos_antigravity_doctor`.
3. **Native Antigravity Plugin & Skills**:
   - `integrations/antigravity/eos-governance/` (`plugin.json`, `hooks.json`, `scripts/eos-hook.mjs`, `rules/AGENTS.md`).
   - `.agents/skills/` (`eos-director/SKILL.md`, `eos-sdd-pipeline/SKILL.md`, `eos-fleet-ops/SKILL.md`).
4. **Automated Installer & CLI (`scripts/install-antigravity-mcp.mjs` & `bin/eos.mjs antigravity`)**: Atomically repairs junctions, updates `~/.gemini/config/mcp_config.json` without touching third-party servers/credentials, and enables `eos-governance` in `~/.gemini/config/config.json`.
5. **Formal TLA+ Specification (`docs/formal/AntigravityControlPlane.tla`) & Test Suite (`test/eosAntigravityDirector.test.mjs`)**.
