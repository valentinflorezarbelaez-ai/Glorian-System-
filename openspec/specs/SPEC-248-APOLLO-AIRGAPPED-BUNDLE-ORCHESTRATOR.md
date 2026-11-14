# SPEC-248 — Layer-0 Apollo Air-Gapped Sovereign Bundle Orchestrator

## Metadata

- **SPEC ID**: SPEC-248
- **Change ID**: CHANGE-124
- **Intake ID**: INTAKE-124
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosApolloAirGappedBundleOrchestratorCore`

---

## 1. Overview

`EosApolloAirGappedBundleOrchestratorCore` packages and cryptographically verifies self-contained software release bundles designed for disconnected (`air-gapped`) deployment targets such as classified SCIF enclaves, satellites, or autonomous edge nodes without network access.

---

## 2. Functional Requirements (EARS Syntax)

**FR-248-001** (Event-Driven)
WHEN `compileAndVerifyAirGappedBundle(options)` runs, THE SYSTEM SHALL sort artifact descriptors deterministically, compute `artifactMerkleRootSha256`, and sign + offline-verify an In-Toto/SLSA Ed25519 DSSE envelope binding that Merkle root.

**FR-248-002** (State-Driven)
WHEN `version` appears in `recalledVersions`, THE SYSTEM SHALL set `recalled = true` and `verdict = "RECALL_BLOCKED"`.

**FR-248-003** (State-Driven)
WHEN `targetNode` violates any of `requiredArch`, `minMemoryMb`, `minQuorumNodes`, or `requireOfflineCapable`, THE SYSTEM SHALL record explicit entries in `constraintViolations`, set `constraintsMet = false`, and set `verdict = "CONSTRAINT_HOLD"`.

**FR-248-004** (Error / Unwanted Condition & Ubiquitous)
IF `writeBundleToDisk` is true and `outputRelPath` escapes `projectRoot`, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`. THE SYSTEM SHALL deep-freeze the output and compute a deterministic `bundleDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1261 — Compiles And Verifies Offline Air-Gapped Bundle As AIRGAP_DEPLOY_READY

```gherkin
SCENARIO: Compile and verify self-contained air-gapped bundle offline
  GIVEN default signed artifacts and compliant disconnected x64 target node
  WHEN EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle runs
  THEN dsseVerified is true, constraintsMet is true, recalled is false, and verdict is "AIRGAP_DEPLOY_READY"
```

### BDD-1262 — Blocks Deployment When Bundle Version Is Recalled

```gherkin
SCENARIO: Halt deployment of revoked bundle version via recall list
  GIVEN version = "75.0.0-bad1" listed in recalledVersions
  WHEN compileAndVerifyAirGappedBundle runs
  THEN recalled is true and verdict is "RECALL_BLOCKED"
```

### BDD-1263 — Places Bundle On CONSTRAINT_HOLD When Node Resources Or ArchMismatch Fail

```gherkin
SCENARIO: Hold air-gapped deployment when target hardware or quorum is insufficient
  GIVEN targetNode with arch = "arm64" against requiredArch = "x64" and insufficient memory
  WHEN compileAndVerifyAirGappedBundle runs
  THEN constraintsMet is false, constraintViolations.length >= 2, and verdict is "CONSTRAINT_HOLD"
```

### BDD-1264 — Confines Bundle Disk Persistence Inside projectRoot

```gherkin
SCENARIO: Persist sovereign bundle inside temp workspace and block "../" escape
  GIVEN writeBundleToDisk = true inside temp projectRoot, then outputRelPath = "../escape.json"
  WHEN compileAndVerifyAirGappedBundle executes
  THEN valid relative path succeeds on disk and escaping path throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1265 — Emits Deterministic Merkle Root And Digest For Fixed Seed

```gherkin
SCENARIO: Produce identical artifactMerkleRootSha256 and bundleDigestSha256 for fixed keySeed
  GIVEN identical artifacts and fixed keySeed executed twice
  WHEN compileAndVerifyAirGappedBundle runs
  THEN artifactMerkleRootSha256 and bundleDigestSha256 match identically
```
