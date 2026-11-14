# SPEC-268 — Layer-0 Smart-Contract Bytecode Gas & Symbolic CEI Verifier Core

## Metadata

- **SPEC ID**: SPEC-268
- **Change ID**: CHANGE-130
- **Intake ID**: INTAKE-130
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosSmartContractBytecodeGasSymbolicVerifierCore`

---

## 1. Overview

`EosSmartContractBytecodeGasSymbolicVerifierCore` provides static symbolic bytecode verification for smart-contract settlement vaults, computing control-flow cyclomatic path bounds, worst-case symbolic EVM gas envelopes across bounded loops and cold `SSTORE` / `CALL` opcodes, and formally verifying Checks-Effects-Interactions (CEI) / mutex reentrancy invariants against block gas ceilings.

---

## 2. Functional Requirements (EARS Syntax)

**FR-268-001** (Event-Driven)
WHEN `evaluateSmartContractBytecodeGasSymbolicVerifier(options)` is invoked, THE SYSTEM SHALL validate non-empty `contractId`, integer `cfgNodeCount >= 1`, integer `cfgEdgeCount >= cfgNodeCount - 1`, integers `maxLoopBound >= 0`, `coldSstoreCount >= 0`, `externalCallCount >= 0`, `stateWritesAfterExternalCall >= 0`, non-negative finite `loopBodyGasCost`, positive finite `blockGasLimitCeiling`, and boolean `reentrancyMutexLocked`.

**FR-268-002** (State-Driven)
WHILE analyzing symbolic CFG execution paths and opcode costs, THE SYSTEM SHALL compute `cyclomaticPaths`, `worstCaseGasUsed`, `gasUtilizationRatio`, and `ceiInvariantSatisfied`.

**FR-268-003** (Error Condition)
IF `!ceiInvariantSatisfied` OR `worstCaseGasUsed > blockGasLimitCeiling` OR `maxLoopBound > 256`, THEN THE SYSTEM SHALL emit regime `"REENTRANCY_OR_UNBOUNDED_GAS_CRITICAL"`; ELSE IF `gasUtilizationRatio > 0.85` OR `stateWritesAfterExternalCall > 0`, THEN THE SYSTEM SHALL emit `"GAS_STIPEND_PRESSURE_WARNING"`; ELSE `"SYMBOLIC_GAS_AND_CEI_PROVED"`.

**FR-268-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `bytecodeGasDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1386 — Bounded Gas & Strict CEI Proof

```gherkin
SCENARIO: Vault contract with zero post-call state writes and 116720 worst-case gas passes proof
  GIVEN default Bytecode Symbolic Gas Verifier options
  WHEN evaluateSmartContractBytecodeGasSymbolicVerifier executes
  THEN regime is "SYMBOLIC_GAS_AND_CEI_PROVED", ceiInvariantSatisfied === true, and gasUtilizationRatio <= 0.85
```

### BDD-1387 — Gas Stipend Pressure or Mutex-Guarded Post-Call Write Warning

```gherkin
SCENARIO: Gas utilization exceeding 85% ceiling or mutex-guarded post-call write triggers warning
  GIVEN maxLoopBound = 25 (with default 150000 ceiling) OR stateWritesAfterExternalCall = 1 with reentrancyMutexLocked = true
  WHEN evaluateSmartContractBytecodeGasSymbolicVerifier executes
  THEN regime is "GAS_STIPEND_PRESSURE_WARNING"
```

### BDD-1388 — Unprotected Reentrancy or Unbounded Gas Critical Failure

```gherkin
SCENARIO: Post-call state write without reentrancy lock or gas exceeding block ceiling fails critically
  GIVEN stateWritesAfterExternalCall = 2 and reentrancyMutexLocked = false
  WHEN evaluateSmartContractBytecodeGasSymbolicVerifier executes
  THEN regime is "REENTRANCY_OR_UNBOUNDED_GAS_CRITICAL" and ceiInvariantSatisfied === false
```

### BDD-1389 — Connected CFG Edge Precondition & Digest Determinism

```gherkin
SCENARIO: Disconnected CFG (edges < nodes - 1) throws PRECONDITION_FAILED and valid calls repeat digest
  GIVEN cfgNodeCount = 10 and cfgEdgeCount = 5 OR valid options invoked twice
  WHEN evaluateSmartContractBytecodeGasSymbolicVerifier executes
  THEN disconnected CFG throws PRECONDITION_FAILED and valid calls share bytecodeGasDigestSha256
```

### BDD-1390 — End-to-End CLI `evm:prove` & MCP `bytecode_symbolic_gas_prover`

```gherkin
SCENARIO: Dispatch Bytecode Gas Symbolic Verifier via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command evm:prove and MCP action "bytecode_symbolic_gas_prover"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "SYMBOLIC_GAS_AND_CEI_PROVED" and a 64-hex bytecodeGasDigestSha256
```
