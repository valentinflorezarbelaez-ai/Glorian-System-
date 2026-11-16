# TASKS-164: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)

- **Tasks ID**: `TASKS-164`
- **Change ID**: `CHANGE-164`
- **Spec Reference**: `SPEC-302`
- **Tier**: Hermetic Infrastructure, Reproducible Builds & Container Sandboxing (Phase 4.3)
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:36:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-164-01: Nix & Bazel Declarative Manifests]
       │
       ▼
[TASK-164-02: Types Definition]
       │
       ▼
[TASK-164-03: Core Hermetic Reproducible Build Governor]
       │
       ▼
[TASK-164-04: Core Re-export & Typecheck]
       │
       ▼
[TASK-164-05: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-164-06: CLI Router, Catalog & Developer Guide Registration]
       │
       ▼
[TASK-164-07: Test Suite (BDD-1587..BDD-1592)]
       │
       ▼
[TASK-164-08: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-164-01: Nix & Bazel Declarative Manifests

- Create `deploy/nix/flake.nix` & `deploy/nix/default.nix`.
- Create `deploy/bazel/WORKSPACE` & `deploy/bazel/BUILD.bazel`.
- Pin Node.js 22.18+, zero-network flags, and canonical build steps.

### TASK-164-02: Types Definition

- Create `src/core/eosHermeticReproducibleBuildGovernor.types.ts`.
- Define `BuildArtifactEntry`, `NormalizationOptions`, `ReproducibleBuildResult`, `ReproducibilityVerificationResult`, `HermeticBuildAuditReceipt`.

### TASK-164-03: Core Hermetic Reproducible Build Governor

- Create `src/core/eosHermeticReproducibleBuildGovernor.ts`.
- Implement `EosHermeticReproducibleBuildGovernor` class:
  - `normalizeArtifacts(artifacts, options)`: Strips ambient timestamps (`SOURCE_DATE_EPOCH`), sorts paths, clamps permissions (`0644`/`0755`), zeroes UID/GID.
  - `computeReproducibleRootDigest(normalized)`: Calculates canonical root SHA-256 digest over normalized manifest and content.
  - `verifyHermeticBuild(buildA, buildB)`: Dual-build comparator emitting `REPRODUCIBLE_MATCH` or `NON_DETERMINISTIC_DRIFT`.
  - `auditHermeticBuildPipeline(options)`: Writes `docs/evidence/HERMETIC_BUILD_RECEIPT.json`.

### TASK-164-04: Core Re-export & Typecheck

- Export in `src/core/index.ts`.
- Run `npm run typecheck` to verify 0 errors.

### TASK-164-05: CLI Subdispatcher Implementation

- Create `bin/commands/cliHermeticBuild.mjs`.
- Implement subcommands: `toolchain:nix:flake`, `toolchain:bazel:build`, `toolchain:build:normalize`, `toolchain:build:verify`.

### TASK-164-06: CLI Router, Catalog & Developer Guide Registration

- Update `bin/commands/cliToolchainRouter.mjs`.
- Register 4 commands in `bin/commands/cliHelpCatalog.mjs`.
- Add documentation in `docs/DEVELOPER_GUIDE.md`.
- Verify 100.00% parity with `node bin/eos.mjs hygiene:audit`.

### TASK-164-07: Test Suite (BDD-1587..BDD-1592)

- Create `test/eosHermeticReproducibleBuildGovernor.test.mjs`.
- Test all 6 BDD scenarios.
- Run `node --test test/eosHermeticReproducibleBuildGovernor.test.mjs` and confirm 100% pass.

### TASK-164-08: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs`.
- Stage, commit, seal pin, and push to `origin/main`.
