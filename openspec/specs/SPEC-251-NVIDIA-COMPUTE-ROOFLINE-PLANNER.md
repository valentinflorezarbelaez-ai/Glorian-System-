# SPEC-251 — Layer-0 Compute Graph Roofline Planner & Static Arena Allocator

## Metadata

- **SPEC ID**: SPEC-251
- **Change ID**: CHANGE-126
- **Intake ID**: INTAKE-126
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosComputeGraphRooflinePlannerCore`

---

## 1. Overview

`EosComputeGraphRooflinePlannerCore` models accelerator hardware using the Roofline performance bound (`peakFlopsGiga` vs. `memoryBandwidthGBps`), fuses eligible linear operator chains (`MATMUL -> BIAS_ADD -> RELU`), schedules deterministic topological execution, and computes a 64-byte aligned zero-fragmentation static memory arena plan.

---

## 2. Functional Requirements (EARS Syntax)

**FR-251-001** (Event-Driven)
WHEN `planComputeGraphAndArena(options)` is invoked, THE SYSTEM SHALL compute `ridgePointFlopsPerByte` (`peakFlopsGiga / memoryBandwidthGBps`) and classify each operator's `arithmeticIntensityFlopsPerByte`, `attainableGflops`, and `boundRegime` (`"COMPUTE_BOUND"` or `"MEMORY_BOUND"`).

**FR-251-002** (State-Driven)
WHILE traversing valid acyclic operator dependencies, THE SYSTEM SHALL fuse single-consumer sequences (`MATMUL -> BIAS_ADD -> RELU`, `MATMUL -> RELU`, or `BIAS_ADD -> RELU`) into `fusedGroups`, accumulating `fusedOperatorsCount` and `memoryTrafficSavedBytes`.

**FR-251-003** (Ubiquitous & Error Condition)
THE SYSTEM SHALL assign contiguous 64-byte aligned offsets (`arenaAllocations`, `fragmentationRatio: 0`) against `memoryBudgetBytes`, emit `"ROOFLINE_OPTIMIZED"` when within budget or `"ARENA_BUDGET_EXCEEDED"` when exceeded, reject cyclic dependency graphs with an explicit `Error`, and seal the report with `deepFreeze` and a 64-hex `rooflineDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1276 — Roofline Ridge Point & Regime Classification

```gherkin
SCENARIO: Classify compute-bound and memory-bound operators accurately
  GIVEN peakFlopsGiga = 312000 and memoryBandwidthGBps = 2000 (ridgePoint = 156)
  WHEN planComputeGraphAndArena evaluates high-intensity MATMUL and low-intensity RELU operators
  THEN MATMUL is classified "COMPUTE_BOUND" and RELU is classified "MEMORY_BOUND"
```

### BDD-1277 — Deterministic Operator Fusion Savings

```gherkin
SCENARIO: Fuse single-consumer MATMUL -> BIAS_ADD -> RELU operator pipeline
  GIVEN linear single-consumer chain matmul -> bias -> relu
  WHEN planComputeGraphAndArena runs
  THEN fusedGroups includes the fused kernel, fusedOperatorsCount >= 2, and memoryTrafficSavedBytes > 0
```

### BDD-1278 — 64-Byte Aligned Static Arena Allocation & Budget Enforcement

```gherkin
SCENARIO: Detect arena memory budget overflow deterministically
  GIVEN operator outputs totaling 2048 bytes and memoryBudgetBytes = 512
  WHEN planComputeGraphAndArena executes
  THEN verdict is "ARENA_BUDGET_EXCEEDED", fragmentationRatio is 0, and every offsetBytes is aligned to 64 bytes
```

### BDD-1279 — Cyclic Dependency Rejection & Deterministic SHA-256 Digest

```gherkin
SCENARIO: Reject cyclic operator graphs fail-closed and emit repeatable SHA-256 digest
  GIVEN an operator graph with cycle A -> B -> A
  WHEN planComputeGraphAndArena is invoked
  THEN an explicit cycle Error is thrown, while repeated nominal runs produce identical rooflineDigestSha256
```

### BDD-1280 — CLI roofline:plan & MCP roofline_compute_plan Dispatch

```gherkin
SCENARIO: Dispatch Roofline Planner via CLI and MCP Server
  GIVEN wired handlers for roofline:plan and eos_enterprise_workspace action "roofline_compute_plan"
  WHEN invoked in JSON mode
  THEN both return verdict "ROOFLINE_OPTIMIZED" and a 64-hex rooflineDigestSha256
```
