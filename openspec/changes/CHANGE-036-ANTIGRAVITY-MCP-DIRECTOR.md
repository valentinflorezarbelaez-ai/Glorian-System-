# CHANGE-036: SOVEREIGN ANTIGRAVITY MCP CONTROL PLANE & DIRECTOR MESH (v49.0.0)

## 1. Change Summary
- **Change ID**: `CHANGE-036`
- **Target Spec**: `SPEC-043`
- **Version Bump**: `48.0.0` -> `49.0.0`
- **Status**: `APPROVED`

## 2. Delta Modifications
1. **Added**: `src/core/eosAntigravityDirector.ts` (Layer-0 pure mission classifier, External Write Barrier evaluator, MCP config synthesizer, and Antigravity integration doctor).
2. **Modified**: `src/mcp/eosMcpServer.ts` (added `instructions` on `initialize`, `2025-03-26` protocol negotiation, `ping`, `prompts/list`, `prompts/get`, `eos://antigravity/director-playbook` resource, `eos_antigravity_direct` and `eos_antigravity_doctor` tools).
3. **Added**: `integrations/antigravity/eos-governance/` (`plugin.json`, `hooks.json`, `scripts/eos-hook.mjs`, `rules/AGENTS.md`) and `.agents/skills/` (`eos-director`, `eos-sdd-pipeline`, `eos-fleet-ops`).
4. **Added**: `scripts/install-antigravity-mcp.mjs` and `bin/eos.mjs` subcommand `antigravity [direct|doctor|install]`.
5. **Modified**: `docs/projects/registry.json` and `src/core/eosFleetSoundcheckMesh.ts` to standardize `crud-slack` onto portable `localPathEnv: "EOS_FLEET_CRUD_SLACK_PATH"`.
6. **Added**: `docs/formal/AntigravityControlPlane.tla` and `test/eosAntigravityDirector.test.mjs`.
