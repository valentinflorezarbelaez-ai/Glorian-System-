# SPEC-269 — Serverless Function Budget Gate & Deployment Truth Engine

## Metadata

- **SPEC ID**: SPEC-269
- **Change ID**: CHANGE-131
- **Intake ID**: INTAKE-131
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-1 (Infrastructure & Quality Gate Automation)
- **Module**: `verify-vercel-function-budget.mjs` & `cliJarvisPolyglotFrontierMesh.mjs`

---

## 1. Overview

`SPEC-269` establishes automated host quota enforcement and epistemic operational alignment for Glorian System deployments. It introduces a fail-closed serverless function budget gate preventing deployment ceiling breaches on hosting providers (such as the Vercel Hobby 12-function hard limit), eliminates unvetted major runtime version drift, and couples the `ship` command with remote deployment state observation to enforce strict epistemic honesty (Law III).

---

## 2. Functional Requirements (EARS Syntax)

**FR-269-001** (Event-Driven)
WHEN `verify-vercel-function-budget.mjs` is executed, THE SYSTEM SHALL scan all files in the `api/` directory, filter out private modules prefixed with `_` or located in directories prefixed with `_`, calculate the active serverless function count, and compare it against `docs/quality/vercel-function-budget.json`.

**FR-269-002** (State-Driven)
WHILE evaluating the serverless function count, THE SYSTEM SHALL verify that `activeCount <= budget` AND `budget <= hardLimit`.

**FR-269-003** (Error Condition)
IF `activeCount > budget`, THEN THE SYSTEM SHALL exit with code `1`, print the offending entrypoints and ceiling limits, and block commit, pull-request, and CI pipeline progression.

**FR-269-004** (Ubiquitous)
THE SYSTEM SHALL ensure that `api/kernel.js` dispatches internal submodules (`_metrics.js`, `_finops.js`, `_specs.js`, `_bigtech.js`) without leaking internal filesystem details or altering public HTTP wire contracts (e.g. Prometheus OpenMetrics text exposition).

**FR-269-005** (Event-Driven)
WHEN `eos ship --remote` is invoked, THE SYSTEM SHALL query remote CI run status and production deployment state; IF remote checks fail or are inaccessible, THE SYSTEM SHALL emit `SHIP_BLOCKED_REMOTE_RED` or `SHIP_APPROVED_LOCAL_ONLY` rather than unconditional `SHIP_APPROVED`.

---

## 3. BDD Acceptance Scenarios

### BDD-1391 — Nominal Serverless Function Budget Conformance

```gherkin
SCENARIO: Public serverless entrypoints stay within Hobby budget with headroom
  GIVEN api directory contains at most 12 public entrypoints and private modules prefixed with underscore
  AND teurgia is consolidated as api/_teurgia.js routed via api/kernel.js
  WHEN verify-vercel-function-budget.mjs is executed
  THEN the gate exits with code 0
  AND reports activeCount <= 12, headroom >= 1, and status PASS
```

### BDD-1392 — Fail-Closed Breach on Excess Serverless Functions

```gherkin
SCENARIO: Addition of a 13th public entrypoint trips the budget gate
  GIVEN an auxiliary public entrypoint api/temp_probe.js exists
  WHEN verify-vercel-function-budget.mjs is executed
  THEN the gate exits with code 1
  AND emits error log identifying active count 13 exceeding budget 12
```

### BDD-1393 — Prometheus Metrics Kernel Dispatch Preservation

```gherkin
SCENARIO: Routed Prometheus metrics endpoint preserves content type and RED telemetry
  GIVEN api/kernel.js is queried with module=metrics or /api/metrics rewrite
  WHEN HTTP GET is dispatched to handler
  THEN response status is 200
  AND Content-Type header includes "text/plain; version=0.0.4"
  AND body contains valid Prometheus HELP and TYPE annotations for glorian metrics
```

### BDD-1394 — Node Engine Version Bounding

```gherkin
SCENARIO: Package json engines bounds Node below major version 25
  GIVEN package.json file
  WHEN engines.node field is read
  THEN it matches range ">=22.18.0 <25"
  AND prevents Vercel build infrastructure from defaulting to Node 26.x
```

### BDD-1395 — Epistemic Remote Status Reporting in Ship

```gherkin
SCENARIO: Ship command with --remote accurately reflects remote infrastructure health
  GIVEN remote GitHub Actions or Vercel production status is queried
  WHEN cmd_ship executes with --remote flag
  THEN shipReadinessVerdict reflects remote state (SHIP_APPROVED, SHIP_BLOCKED_REMOTE_RED, or SHIP_APPROVED_LOCAL_ONLY)
  AND includes remoteChecks object in JSON output
```
