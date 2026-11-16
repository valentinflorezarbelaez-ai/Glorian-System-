# SPEC-302: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)

- **Specification ID**: `SPEC-302`
- **Change ID**: `CHANGE-164`
- **Status**: `APPROVED`
- **Module**: `src/core/eosHermeticReproducibleBuildGovernor.ts`
- **Tier**: Hermetic Infrastructure, Reproducible Builds & Container Sandboxing (Phase 4.3)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-302-01 (Event-Driven Declarative Toolchain Pinning)**: WHEN a build configuration is generated, THE SYSTEM SHALL produce deterministic declarative Nix Flake (`deploy/nix/flake.nix`) and Bazel (`deploy/bazel/BUILD.bazel`) manifests pinning exact compiler versions, Node.js 22.18+ runtimes, and build rules.
- **FR-302-02 (State-Driven Zero-Network Sandbox Isolation)**: MIENTRAS a build step executes in hermetic mode, THE SYSTEM SHALL enforce a zero-network sandbox boundary, rejecting any ambient network calls or unpinned external resource fetches during compilation.
- **FR-302-03 (Event-Driven Canonical Archive Normalization)**: WHEN build output files and assets are packaged, THE SYSTEM SHALL normalize file modification timestamps to `SOURCE_DATE_EPOCH`, clamp file permissions to canonical masks (`0644` for files, `0755` for executables), standardize UID/GID to 0, and sort archive entries lexicographically.
- **FR-302-04 (State-Driven Bit-for-Bit Multi-Build Verification)**: MIENTRAS two or more independent builds of the same source tree are compiled across disparate build machines, filesystem paths, or timestamps, THE SYSTEM SHALL compare the output byte streams and assert identical SHA-256 digests (`REPRODUCIBLE_MATCH`).
- **FR-302-05 (Error / Unwanted Condition: Non-Deterministic Drift Rejection)**: SI an output artifact differs by even a single bit between independent builds, ENTONCES EL SISTEMA SHALL abort verification fail-closed with `NON_DETERMINISTIC_DRIFT` and pinpoint the diverging artifact paths.
- **FR-302-06 (Cryptographic Proof Receipt)**: WHEN a reproducible build audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/HERMETIC_BUILD_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1587 Declarative Nix Flake and Bazel Manifest Generation
  GIVEN a project repository configuration
  WHEN the governor generates hermetic deployment manifests
  THEN deploy/nix/flake.nix and deploy/bazel/BUILD.bazel are created
  AND contain pinned Node.js 22.18+ toolchains, hermetic derivation rules, and zero-network sandboxing flags.

SCENARIO: BDD-1588 Canonical Archive Normalization (SOURCE_DATE_EPOCH & Permissions)
  GIVEN an unnormalized collection of build output files with disparate timestamps, permissions, and file ordering
  WHEN the governor applies canonical archive normalization
  THEN timestamps are clamped to the canonical SOURCE_DATE_EPOCH (1700000000)
  AND file permissions are normalized to 0644/0755, UID/GID are 0, and paths are lexicographically sorted.

SCENARIO: BDD-1589 Bit-for-Bit Deterministic Artifact Digest Computation
  GIVEN identical source trees compiled in two separate environments with identical SOURCE_DATE_EPOCH
  WHEN reproducible hashes are calculated for both build outputs
  THEN both independent builds produce bit-for-bit identical SHA-256 digests.

SCENARIO: BDD-1590 Multi-Build Dual Verification (REPRODUCIBLE_MATCH)
  GIVEN Build A and Build B outputs produced independently
  WHEN the governor executes verifyHermeticBuild(buildA, buildB)
  THEN the verification emits verdict REPRODUCIBLE_MATCH with matchedArtifacts count and identical root digest.

SCENARIO: BDD-1591 Non-Deterministic Drift Detection and Divergence Isolation
  GIVEN Build A and Build B where an artifact contains unstripped ambient timestamps or modified bytes
  WHEN verifyHermeticBuild is evaluated
  THEN the governor emits NON_DETERMINISTIC_DRIFT
  AND isolates the exact diverging file paths and byte delta offsets fail-closed.

SCENARIO: BDD-1592 End-to-End Cryptographic Audit Receipt Generation
  GIVEN an audit executed via toolchain:build:verify or auditHermeticBuildPipeline
  WHEN the audit completes
  THEN docs/evidence/HERMETIC_BUILD_RECEIPT.json is written
  AND contains totalArtifactsVerified, reproducibilityRatio (1.0), bitForBitIdentical, and a valid sha256Signature.
```
