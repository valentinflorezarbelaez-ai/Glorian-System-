# SPEC-246 — Layer-0 Golden SWE Benchmark Harness

## Metadata

- **SPEC ID**: SPEC-246
- **Change ID**: CHANGE-123
- **Intake ID**: INTAKE-123
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosGoldenSweBenchmarkHarnessCore`

---

## 1. Overview

`EosGoldenSweBenchmarkHarnessCore` executes a reproducible corpus of clean and adversarial software-engineering verification scenarios against Glorian's live diff inspector, contract diff engine, property-based shrinking fuzzer, and Law IV fleet orchestrator, computing confusion-matrix classification metrics (`precision`, `recall`, `f1Score`, `falsePositiveRate`, `accuracy`).

---

## 2. Functional Requirements (EARS Syntax)

**FR-246-001** (Event-Driven)
WHEN `runGoldenBenchmark(options)` executes without `casesOverride`, THE SYSTEM SHALL run 8 deterministic clean and adversarial scenarios covering clean diffs, credential injection, missing tests (Beyoncé Rule), destructive SQL DDL, breaking API removal, property counterexample detection, compliant fleet readiness, and unmet Law IV fleet preconditions.

**FR-246-002** (State-Driven)
WHILE classifying each case against `expectedBlock` and `actualBlock` (`TP`, `TN`, `FP`, `FN`), THE SYSTEM SHALL compute exact rounded `precision`, `recall`, `f1Score`, `falsePositiveRate`, and `accuracy`.

**FR-246-003** (Event-Driven)
WHEN custom `casesOverride` arrays containing intentional false positives or false negatives are supplied, THE SYSTEM SHALL report accurate non-unity confusion-matrix rates without clamping away errors.

**FR-246-004** (Ubiquitous)
THE SYSTEM SHALL emit a repeatable 64-hex `benchmarkDigestSha256`, deep-freeze all outputs, and expose CLI commands (`contract:live`, `attest:ship`, `bench:swe`, enriched `ship`) plus MCP actions (`live_contract_evolution`, `intoto_slsa_attest`, `golden_swe_benchmark`).

---

## 3. BDD Acceptance Scenarios

### BDD-1251 — Built-In 8-Case Adversarial SWE Corpus Achieves 1.0 F1-Score

```gherkin
SCENARIO: Execute built-in 8-scenario adversarial SWE benchmark against live Glorian engines
  GIVEN default RunGoldenSweBenchmarkOptions with no casesOverride
  WHEN EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark executes
  THEN totalCases is 8, precision is 1, recall is 1, f1Score is 1, and falsePositiveRate is 0
```

### BDD-1252 — Accurately Computes Confusion Matrix With Simulated FP/FN Cases

```gherkin
SCENARIO: Calculate exact TP/TN/FP/FN precision, recall, F1, and FPR on mixed synthetic cases
  GIVEN casesOverride with 1 TP, 1 TN, 1 FP, and 1 FN
  WHEN runGoldenBenchmark executes
  THEN precision is 0.5, recall is 0.5, f1Score is 0.5, falsePositiveRate is 0.5, and accuracy is 0.5
```

### BDD-1253 — Emits Repeatable SHA-256 Benchmark Digest

```gherkin
SCENARIO: Repeat identical benchmarkDigestSha256 across deterministic runs
  GIVEN the built-in corpus invoked twice
  WHEN runGoldenBenchmark executes twice
  THEN both reports emit equal 64-hex benchmarkDigestSha256 hashes
```

### BDD-1254 — Executes `contract:live`, `attest:ship`, `bench:swe` & Upgraded `ship` CLI Commands

```gherkin
SCENARIO: Invoke all three new CLI commands plus enriched master ship command with --json
  GIVEN Glorian CLI entrypoint bin/eos.mjs
  WHEN contract:live --json, attest:ship --json, bench:swe --json, and ship --ticket=SPOT-246 --json run
  THEN all four exit 0 with valid JSON matching SPEC-244..SPEC-246 schemas
```

### BDD-1255 — Dispatches MCP Frontier Actions `live_contract_evolution`, `intoto_slsa_attest`, `golden_swe_benchmark`

```gherkin
SCENARIO: Dispatch all three CHANGE-123 actions via dispatchPhase7FrontierActionExt2
  GIVEN MCP Phase 7 handler ext2 preserving the 46 Tier-0 tool count
  WHEN live_contract_evolution, intoto_slsa_attest, and golden_swe_benchmark execute
  THEN each returns structured attested outputs with verified Ed25519 signature and F1 = 1
```
