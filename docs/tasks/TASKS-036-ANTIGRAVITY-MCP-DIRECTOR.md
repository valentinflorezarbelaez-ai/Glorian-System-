# TASKS-036: ATOMIC TASK DAG — ANTIGRAVITY MCP CONTROL PLANE (v49.0.0)

- [x] **T-036-1**: Record `INTAKE-036`, `SPEC-043`, `CHANGE-036`, `PLAN-036` (`ADR-049`), `AntigravityControlPlane.tla`, and `AUTH-2026-10-30-ANTIGRAVITY-MCP-DIRECTOR-043` in `IMPLEMENTATION_AUTHORIZATION.md`.
  - *Done Criteria*: Complete specification package present and authorized (`LEVEL 3`).
- [x] **T-036-2**: Register `verifyAntigravityControlPlaneModel()` in `scripts/verify-formal-tla.mjs`.
  - *Done Criteria*: `node scripts/verify-formal-tla.mjs` passes 9/9 formal TLA+ bounded JS simulations (2,000 steps).
- [x] **T-036-3**: Implement Layer-0 `src/core/eosAntigravityDirector.ts` and standardize `crud-slack` `localPathEnv` in `docs/projects/registry.json` & `src/core/eosFleetSoundcheckMesh.ts`.
  - *Done Criteria*: 0 runtime dependencies, `npm run typecheck` passes with 0 errors.
- [x] **T-036-4**: Upgrade `src/mcp/eosMcpServer.ts` with `initialize.instructions`, `2024-11-05`/`2025-03-26` negotiation, `ping`, `prompts/list`, `prompts/get`, `eos://antigravity/director-playbook`, `eos_antigravity_direct`, and `eos_antigravity_doctor`.
  - *Done Criteria*: All existing and new MCP JSON-RPC invariants pass.
- [x] **T-036-5**: Author `integrations/antigravity/eos-governance/` (`plugin.json`, `hooks.json`, `scripts/eos-hook.mjs`, `rules/AGENTS.md`), `.agents/skills/` (`eos-director`, `eos-sdd-pipeline`, `eos-fleet-ops`), `scripts/install-antigravity-mcp.mjs`, and `bin/eos.mjs` `antigravity` CLI commands.
  - *Done Criteria*: Installer repairs broken junctions in `~/.gemini/config/`, wires `EOS_FLEET_*_PATH` in `~/.gemini/config/mcp_config.json`, and `eos antigravity doctor` scores 100/100.
- [x] **T-036-6**: Author `test/eosAntigravityDirector.test.mjs` covering `BDD-124` through `BDD-127` and run full 7-stage `npm run test` (`verify:strict`) + `node bin/eos.mjs turbo`.
  - *Done Criteria*: 7/7 stages exit 0 across all 50 test suites; commit and push to `origin/main`.
