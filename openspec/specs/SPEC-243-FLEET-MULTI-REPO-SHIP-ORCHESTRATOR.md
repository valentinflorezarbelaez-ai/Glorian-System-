# SPEC-243 — Layer-0 Fleet Multi-Repo Ship Orchestrator

## Metadata

- **SPEC ID**: SPEC-243
- **Change ID**: CHANGE-122
- **Intake ID**: INTAKE-122
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosFleetMultiRepoShipOrchestratorCore`

---

## 1. Overview

`EosFleetMultiRepoShipOrchestratorCore` inspects the registered fleet catalog (`docs/projects/registry.json` by default, or caller-supplied `projectsOverride`), enforces all 6 EOS Constitution Law IV preconditions per project, optionally checks local sibling checkout presence, and produces a unified fleet ship readiness report and CLI/MCP orchestration dispatch.

---

## 2. Functional Requirements (EARS Syntax)

**FR-243-001** (Event-Driven)
WHEN `orchestrateFleetShipReadiness(options)` evaluates fleet projects loaded from `registryRelPath` (confined inside `projectRoot`) or `projectsOverride`, THE SYSTEM SHALL verify all 6 EOS Law IV preconditions per entry: `status === "REGISTERED"`, `intake === "INTAKE_COMPLETE"`, `specification === "SPECIFICATION_APPROVED"`, `audit === "AUDIT_COMPLETE"`, `ownerApproval === "OWNER_APPROVAL"`, and `/^LEVEL_[23]/` authorization.

**FR-243-002** (Error / Unwanted Condition)
IF `registryRelPath` escapes `projectRoot` via path traversal, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`.

**FR-243-003** (State-Driven)
WHILE evaluating each project, THE SYSTEM SHALL compute `readinessScore` starting at `100` minus `16` per missing Law IV precondition (clamped to `[0, 100]`), set `shipReady = lawIvBarrierPassed`, and assign `fleetVerdict = "FLEET_SHIP_READY"` only when `totalProjects > 0` and `blockedProjects === 0` (otherwise `"FLEET_PARTIAL_BLOCK"`).

**FR-243-004** (Ubiquitous)
THE SYSTEM SHALL emit deep-frozen project statuses with individual `repoDigestSha256` hashes, aggregate `averageReadinessScore`, and deterministic 64-hex `fleetShipDigestSha256`, and wire CLI commands (`contract:diff`, `sarif:export`, `fleet:ship`) and MCP actions (`api_contract_diff`, `sarif_patch_synthesize`, `fleet_ship_orchestrate`).

---

## 3. BDD Acceptance Scenarios

### BDD-1236 — Authorizes Clean Registered Fleet Of 9 Repositories

```gherkin
SCENARIO: Validate all 9 registered repositories in docs/projects/registry.json as FLEET_SHIP_READY
  GIVEN the repository docs/projects/registry.json with 9 LEVEL_3 authorized fleet entries
  WHEN EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness runs
  THEN totalProjects is 9, blockedProjects is 0, averageReadinessScore is 100, and fleetVerdict is "FLEET_SHIP_READY"
```

### BDD-1237 — Blocks Fleet Verdict When Law IV Preconditions Are Missing

```gherkin
SCENARIO: Flag partial block when a project lacks audit or owner approval
  GIVEN projectsOverride containing one compliant project and one project with audit="AUDIT_PENDING" and authorization="LEVEL_1"
  WHEN orchestrateFleetShipReadiness executes
  THEN blockedProjects is 1, fleetVerdict is "FLEET_PARTIAL_BLOCK", and missingPreconditions lists the unmet Law IV gates
```

### BDD-1238 — Rejects Path Traversal On Registry Path

```gherkin
SCENARIO: Fail closed on registryRelPath escaping projectRoot
  GIVEN registryRelPath = "../../etc/passwd"
  WHEN orchestrateFleetShipReadiness executes
  THEN the call throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1239 — Produces Deterministic SHA-256 Fleet Digest

```gherkin
SCENARIO: Produce identical fleetShipDigestSha256 across repeated fleet checks
  GIVEN an identical projectsOverride array
  WHEN orchestrateFleetShipReadiness runs twice
  THEN both reports emit equal 64-hex fleetShipDigestSha256 values
```

### BDD-1240 — Verifies Unified CLI And MCP Dispatch Across CHANGE-122

```gherkin
SCENARIO: Invoke contract:diff, sarif:export, fleet:ship, upgraded ship CLI, and all 3 MCP actions
  GIVEN Glorian CLI binary bin/eos.mjs and MCP handler eos_enterprise_workspace
  WHEN executing contract:diff --json, sarif:export --json, fleet:ship --json, ship --json, and dispatching api_contract_diff, sarif_patch_synthesize, fleet_ship_orchestrate
  THEN every invocation exits 0 and returns structured contracts conforming to SPEC-241..243
```
