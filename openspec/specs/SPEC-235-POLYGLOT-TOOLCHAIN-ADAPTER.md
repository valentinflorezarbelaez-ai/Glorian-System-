# SPEC-235 — Layer-0 Polyglot Toolchain Adapter & Universal Verification Normalizer

## Metadata

- **SPEC ID**: SPEC-235
- **Change ID**: CHANGE-120
- **Intake ID**: INTAKE-120
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosPolyglotToolchainAdapterCore`

---

## 1. Overview

`EosPolyglotToolchainAdapterCore` extends `SPEC-234` (`EosJarvisSdlcOrchestratorCore`) beyond TypeScript/Node so Glorian System deterministically supports `java-maven`, `java-gradle`, `go`, `python`, `rust`, and `typescript-node` codebases without external runtime packages.

---

## 2. Functional Requirements (EARS Syntax)

**FR-235-001** (Event-Driven)
WHEN `detectStackAndBuildMatrix(options)` is invoked with a `PolyglotStackId` or bounded `repoPath`, THE SYSTEM SHALL identify manifest files (`pom.xml`, `build.gradle`, `build.gradle.kts`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`, `package.json`) and emit a deterministic `PolyglotToolchainProfile` containing canonical `build`, `test`, `coverage`, `lint`, `typecheck`, and `securityAudit` commands plus Hexagonal Golden Path directories and a 64-hex `profileDigestSha256`.

**FR-235-002** (Error / Unwanted Condition)
IF `repoPath` escapes `projectRoot` via path traversal or invalid relative resolution, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden` before inspecting the filesystem.

**FR-235-003** (Event-Driven)
WHEN `normalizeTestAndCoverageReport(input)` receives raw compiler/test output (`Maven Surefire`, `go test -cover`, `pytest`, `cargo test`, or Node/Vitest) OR explicit numeric overrides, THE SYSTEM SHALL deterministically extract `testsPassed`, `totalTests`, `coveragePercent`, architectural boundary flags, and plain-secret counts into a canonical `JarvisValidationInput` compatible with `SPEC-234`, setting `parsedFromRawOutput` and emitting a 64-hex `reportDigestSha256`.

**FR-235-004** (Ubiquitous)
THE SYSTEM SHALL enforce pure Layer-0 isolation (`node:*` and `src/core/*.ts` imports only), keep cyclomatic complexity `<= 15`, and keep all source files `<= 800` lines.

---

## 3. BDD Acceptance Scenarios

### BDD-1196 — Java Maven & Go Stack Matrix Detection

```gherkin
SCENARIO: Build canonical command matrix and Golden Path layout for Java Maven and Go
  GIVEN stackId "java-maven" or "go" with serviceName "playback-telemetry"
  WHEN detectStackAndBuildMatrix is called
  THEN language and buildTool MUST match the target ecosystem
  AND commands MUST provide non-empty build, test, coverage, lint, typecheck, and securityAudit entries
  AND hexagonalDirectories MUST define domain, application, ports, adapters, and tests
  AND profileDigestSha256 MUST be a valid 64-character lowercase hex digest
```

### BDD-1197 — Confined Repository Signal Inspection & Traversal Rejection

```gherkin
SCENARIO: Detect stack manifest inside projectRoot and reject external path traversal
  GIVEN a bounded temp repository inside projectRoot containing "go.mod" and an escaping path "../outside"
  WHEN detectStackAndBuildMatrix runs on the confined directory
  THEN stackId MUST resolve to "go" and detectedManifests MUST contain "go.mod"
  AND invoking detectStackAndBuildMatrix on "../outside" MUST throw a confinement error
```

### BDD-1198 — Parse Raw Maven Surefire & Go Coverage Logs

```gherkin
SCENARIO: Extract structured JarvisValidationInput from Maven Surefire and Go test logs
  GIVEN Maven log "Tests run: 24, Failures: 1, Errors: 0, Skipped: 0" OR Go log "ok pkg 0.12s coverage: 91.4% of statements"
  WHEN normalizeTestAndCoverageReport is executed
  THEN parsedFromRawOutput MUST be true
  AND Maven MUST yield totalTests=24 and testsPassed=23
  AND Go MUST yield coveragePercent=91.4
```

### BDD-1199 — Parse Pytest and Cargo Raw Logs with Default Guards

```gherkin
SCENARIO: Normalize pytest and cargo test logs into JarvisValidationInput
  GIVEN pytest output "18 passed, 2 failed in 0.42s" OR cargo output "test result: ok. 15 passed; 0 failed; 0 ignored"
  WHEN normalizeTestAndCoverageReport runs
  THEN parsedFromRawOutput MUST be true
  AND pytest MUST resolve testsPassed=18, totalTests=20 while cargo resolves testsPassed=15, totalTests=15
```

### BDD-1200 — Explicit Validation Override Integration with Jarvis Orchestrator

```gherkin
SCENARIO: Feed normalized polyglot report directly into EosJarvisSdlcOrchestratorCore.verifyAndHealMission
  GIVEN a normalized Go report with 14/14 passing tests and 94% coverage
  WHEN passed to verifyAndHealMission on a Spotify mission state
  THEN verifyAndHealMission MUST transition cleanly to "READY_FOR_APPROVAL" with Soundcheck 100
```
