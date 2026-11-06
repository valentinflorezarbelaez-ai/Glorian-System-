---
name: eos-fleet-ops
description: Governs multi-repository fleet audits, Spotify Soundcheck scoring, MCTS parameter tuning, progressive canary rollouts, and isolated Git worktree operations via the EOS MCP Control Plane. Use when auditing, elevating, or deploying across registered fleet repositories.
---

# EOS Sovereign Fleet Operations & Progressive Delivery

Use this skill when coordinating health checks, cross-repository standards, worktree isolation, or progressive rollouts across the registered EOS fleet (`docs/projects/registry.json`).

## 1. Registered Fleet & Law IV External Write Barrier

All fleet repositories are declared in `docs/projects/registry.json` using portable environment variables injected into Antigravity's `eos-system` MCP server:
- `EOS_FLEET_EOS_SYSTEM_PATH` (`eos-system`)
- `EOS_FLEET_ABERAMENTHO_PATH` (`aberamentho-pleroma`)
- `EOS_FLEET_PORTAFOLIO_PATH` (`valentin-portfolio`)
- `EOS_FLEET_PTG_PATH` (`performance-talent-group`)
- `EOS_FLEET_CRUD_SLACK_PATH` (`crud-slack`)

Never write to an external directory unless `eos_antigravity_direct` confirms `writeBarrierStatus: "AUTHORIZED"`.

## 2. Fleet Governance MCP Workflow

Execute the following tools via `call_mcp_tool` (`ServerName: "eos-system"`):

1. **Spotify Soundcheck & Quorum Verification (`eos_fleet_soundcheck`)**
   Audits all registered fleet repositories across 5 weighted dimensions (Git Cleanliness, Security Gates, Test Infrastructure, SDD Governance, Zero-Secret Hygiene) and verifies `deploymentAuthorizedQuorum` (average score `>= 70`):
   ```json
   {
     "ServerName": "eos-system",
     "ToolName": "eos_fleet_soundcheck",
     "Arguments": {}
   }
   ```

2. **Backstage Golden Path Elevation (`eos_fleet_elevate` / `eos_universal_adapt`)**
   Inspects repository maturity (`0..100`) and identifies missing CI/CD hooks, OpenSpec structure, or security headers without destructive mutations (`dryRun: true` by default).

3. **Isolated Agentic Worktrees (`eos_manage_worktree`)**
   When running risky refactors or parallel subagents, create an isolated Git worktree (`action: "list" | "create" | "remove"`) so uncommitted experiments never pollute `main`.

4. **MCTS Runtime Hyper-Tuning (`eos_mcts_tune`)**
   Runs deterministic Upper Confidence Bound for Trees (UCT) simulations (`{ "iterations": 120, "seed": 42 }`) to converge concurrency, ring-buffer, and GC thresholds before release.

5. **Progressive Canary Delivery (`eos_canary_rollout`)**
   Evaluates staged traffic promotion (`1% -> 5% -> 25% -> 100%`) with automatic fail-closed circuit-breaker rollback (`ROLLED_BACK_SAFE`) if error rate exceeds `0.1%` or P99 latency degrades beyond `25%`:
   ```json
   {
     "ServerName": "eos-system",
     "ToolName": "eos_canary_rollout",
     "Arguments": {
       "versionTarget": "v49.0.0",
       "previousVersion": "v48.0.0"
     }
   }
   ```

## 3. Antigravity Control Plane Self-Healing

If any fleet environment variable or NTFS junction drifts on a developer workstation, run:
```powershell
node bin/eos.mjs antigravity install
node bin/eos.mjs antigravity doctor
```
Confirm `readinessScore: 100` (`SOVEREIGN_DIRECTING`) and `singleServerInvariantVerified: true`.
