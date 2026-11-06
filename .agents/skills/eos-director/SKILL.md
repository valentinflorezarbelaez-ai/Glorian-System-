---
name: eos-director
description: Orchestrates engineering missions in Google Antigravity through the EOS System MCP Control Plane (`eos-system`). Use whenever planning, directing, auditing, refactoring, or verifying software across EOS-governed repositories.
---

# EOS Sovereign Antigravity Mission Director

This skill connects Google Antigravity's execution loop directly to the **EOS System MCP Control Plane** (`ServerName: "eos-system"`). Follow this protocol so every task is classified, governed by the Seven Inviolable Commandments, and sealed with verifiable cryptographic evidence.

## 1. Mission Intake & Profile Classification (Always First)

Before mutating files on any non-trivial feature, refactor, security fix, or multi-repo operation, invoke `eos_antigravity_direct` via `call_mcp_tool`:

```json
{
  "ServerName": "eos-system",
  "ToolName": "eos_antigravity_direct",
  "Arguments": {
    "directive": "<concise summary of user request>",
    "target": "eos-system"
  }
}
```

Inspect the returned `MissionDirectionPlan`:
- **`profile`**: `SDD_FULL_21_STEP`, `SECURITY_HARDENING`, `FLEET_ORCHESTRATION`, `PERFORMANCE_TUNING`, `ARCHITECTURE_AUDIT`, or `BUGFIX_FDIR`.
- **`writeBarrierStatus`**:
  - `AUTHORIZED`: Target repository satisfies all 6 Law IV preconditions in `docs/projects/registry.json`. Proceed with the prescribed DAG.
  - `BLOCKED_BY_LAW_IV`: Target is unregistered or missing preconditions (`missingPreconditions`). **STOP** write operations on that target until intake, specification, audit, and Level 2+ authorization are completed.
- **`prescribedMcpDag`**: Execute the ordered list of EOS MCP tools returned for the mission profile.
- **`requiredSkills`**: Load `eos-sdd-pipeline` or `eos-fleet-ops` when listed.

## 2. Core EOS MCP Tool Playbook

Because `eos-system` tools are lazily loaded by Antigravity to preserve context budget, inspect `<appDataDir>/mcp/eos-system/<toolName>.json` when unsure of arguments, then invoke via `call_mcp_tool`:

1. **Architectural & Spec Discovery**
   - `eos_semantic_search`: Hybrid BM25 + vector retrieval over EOS specifications, ADRs, and laws (`{ "query": "...", "topK": 3 }`).
   - `eos_check_architecture`: Audits Layer-0 hexagonal purity (0 runtime npm dependencies) and circular import freedom (`{ "targetDir": "src" }`).
   - `eos_get_blast_radius`: Computes transitive dependents and predictive test suites (`{ "changedFiles": ["src/core/..."] }`).

2. **Constitutional Tribunal & Pre-Mutation Safety**
   - `eos_evaluate_decision`: Runs Bayesian 7-Law tribunal evaluation (`{ "title": "...", "description": "...", "proposedAction": "..." }`).
   - `eos_tmr_consensus`: Executes Triple Modular Redundancy (3-sandbox Byzantine quorum) on critical directives (`{ "directive": "..." }`).
   - `eos_validate_patch`: Validates candidate code for syntax, secret-free compliance (Law VI), and non-destructive safety (`{ "filePath": "src/...", "content": "..." }`).

3. **Fast Verification & Control Plane Health**
   - `eos_turbo_verify`: Runs sub-200ms in-memory 4-stage credential, architecture, and SHA-256 inventory verification (`{}`).
   - `eos_antigravity_doctor`: Audits global `mcp_config.json`, `SingleServerInvariant`, `eos-governance` plugin hooks, skills, and NTFS junctions (`{}`).

## 3. Mandatory Completion & Epistemic Evidence Gate (Law III)

Never claim `VERIFIED` or `PRODUCTION_READY` without running and confirming exit code `0` on:
1. `eos_turbo_verify` (via `call_mcp_tool` on `eos-system`).
2. `npm run test` / `npm run verify:strict` (7-stage SecDevOps repository pipeline + formal TLA+ bounded JS simulations).
3. `eos_fleet_soundcheck` when changes affect registered fleet repositories or shared contracts.
