# SPEC-101 — Layer-0 Rotated Surface Code Quantum Error Correction & Magic-State Factory Governor

## Metadata

- **SPEC ID**: SPEC-101
- **Change ID**: CHANGE-127
- **Intake ID**: INTAKE-127
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosSurfaceCodeQuantumErrorCorrectionCore`

---

## 1. Overview

`EosSurfaceCodeQuantumErrorCorrectionCore` models fault-tolerant rotated planar surface codes across odd code distances ($d \in \{3, 5, 7, \dots\}$), evaluates exponential logical error suppression $\Lambda = p_{\text{th}} / p_{\text{phys}}$, computes physical qubit budgets ($2d^2 - 1$ per logical patch plus 15-to-1 Bravyi-Kitaev magic-state factories), and pairs stabilizer syndrome defect coordinates greedily to preserve parity invariants.

---

## 2. Functional Requirements (EARS Syntax)

**FR-101-001** (Event-Driven)
WHEN `auditSurfaceCodeLogicalFidelity(options)` is invoked, THE SYSTEM SHALL validate that all `distances` are finite odd integers `>= 3`, `0 < physicalErrorRate < 1`, and `0 < thresholdErrorRate < 1`, throwing a precondition error if any invariant is violated.

**FR-101-002** (State-Driven)
WHILE evaluating each target distance $d$, THE SYSTEM SHALL compute $\Lambda = p_{\text{th}} / p_{\text{phys}}$, `physicalQubitsPerLogical = 2 * d * d - 1`, and `logicalErrorRate = 0.1 * Math.pow(lambdaFactor, -(d + 1) / 2)`, confirming monotonic suppression across increasing odd distances whenever $\Lambda > 1$.

**FR-101-003** (Event-Driven)
WHEN syndrome defects or cyclic defect triggers are provided, THE SYSTEM SHALL pair an even number of defects via minimum-Manhattan-distance greedy matching (`stabilizerDefectsMatched`) or escalate if unrecoverable parity drift exceeds threshold.

**FR-101-004** (Ubiquitous)
THE SYSTEM SHALL calculate 15-to-1 magic-state factory physical qubit overhead (`magicStateFactoryQubits`) and `totalPhysicalQubitsRequired`, sealing the immutable report with `deepFreeze` and a 64-hex `qecDigestSha256`.

**FR-101-005** (Error Condition)
IF `physicalErrorRate >= thresholdErrorRate` ($\Lambda \le 1$), THEN THE SYSTEM SHALL emit verdict `"ABOVE_FAULT_THRESHOLD_HALT"`; ELSE IF target logical fidelity is unmet by the highest configured distance, THEN THE SYSTEM SHALL emit `"INSUFFICIENT_CODE_DISTANCE"`; ELSE `"BELOW_THRESHOLD_SUPPRESSION"`.

---

## 3. BDD Acceptance Scenarios

### BDD-1291 — Below-Threshold Exponential Suppression (`Lambda > 1`)

```gherkin
SCENARIO: Below-threshold physical noise yields exponential logical error suppression
  GIVEN distances [3, 5, 7] with physicalErrorRate = 0.0025 and thresholdErrorRate = 0.01
  WHEN auditSurfaceCodeLogicalFidelity executes
  THEN verdict is "BELOW_THRESHOLD_SUPPRESSION", lambdaFactor is 4, and logical error rate strictly decreases with d
```

### BDD-1292 — Above-Threshold Noise Triggers Fail-Closed Halt

```gherkin
SCENARIO: Physical error rate exceeding threshold triggers ABOVE_FAULT_THRESHOLD_HALT
  GIVEN physicalErrorRate = 0.015 and thresholdErrorRate = 0.01
  WHEN auditSurfaceCodeLogicalFidelity executes
  THEN verdict is "ABOVE_FAULT_THRESHOLD_HALT" and exponentialSuppressionVerified is false
```

### BDD-1293 — Insufficient Code Distance Detection

```gherkin
SCENARIO: Target logical fidelity stricter than maximum distance returns INSUFFICIENT_CODE_DISTANCE
  GIVEN distances [3] with targetLogicalErrorRate = 1e-12 and physicalErrorRate = 0.005
  WHEN auditSurfaceCodeLogicalFidelity executes
  THEN verdict is "INSUFFICIENT_CODE_DISTANCE"
```

### BDD-1294 — Rotated Physical Qubit Accounting, Parity Matching & Input Validation

```gherkin
SCENARIO: Validate odd code distances, physical qubit counts (2d^2 - 1), and deterministic digest
  GIVEN an even code distance d = 4 OR valid odd distance d = 5 with syndrome defects
  WHEN auditSurfaceCodeLogicalFidelity executes
  THEN even d throws an error, d = 5 reports 49 data+ancilla qubits, and qecDigestSha256 is deterministic 64-hex
```

### BDD-1295 — End-to-End CLI `qec:decode` & JSON-RPC MCP `quantum_qec_decode`

```gherkin
SCENARIO: Dispatch Surface Code QEC via CLI and full EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler qec:decode and MCP action "quantum_qec_decode" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both succeed with verdict "BELOW_THRESHOLD_SUPPRESSION" and a 64-hex qecDigestSha256
```
