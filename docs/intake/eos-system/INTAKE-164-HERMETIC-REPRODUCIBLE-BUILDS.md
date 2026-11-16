# INTAKE-164: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)

- **Intake ID**: `INTAKE-164`
- **Change ID**: `CHANGE-164`
- **Spec Reference**: `SPEC-302`
- **Target Module**: `src/core/eosHermeticReproducibleBuildGovernor.ts`
- **Tier**: Hermetic Infrastructure, Reproducible Builds & Container Sandboxing (Phase 4.3)
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-16T09:36:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

In planetary-scale autonomous software engineering, software supply chain attacks (such as SolarWinds, XZ Utils backdoor, and dependency injection) frequently exploit non-deterministic build environments, floating compiler versions, ambient build-host metadata, and uncontrolled network access during compilation.

Reproducible Builds (as defined by reproducible-builds.org, Nix, and Google's Bazel) guarantee that given the exact same source code and declarative build manifest, any build machine anywhere in the world will generate a bit-for-bit identical binary output ($Hash(Build_A) \equiv Hash(Build_B)$).

To achieve total immunity against build-host drift, compromised CI runners, and supply chain poisoning while strictly observing **Law V** (zero runtime third-party dependencies), Glorian System requires:

1. **Declarative Toolchain Pinning (Nix & Bazel)**: Declarative `flake.nix` and `BUILD.bazel` specifications pinning the exact cryptographic hashes of Node.js 22.18+, kernel headers, and build tools.
2. **Zero-Network Build Isolation**: Strict hermetic compilation boundaries where compilation steps execute without network access, guaranteeing that no external unverified assets are downloaded during build time.
3. **Canonical Archive Normalization (`SOURCE_DATE_EPOCH`)**: Normalization of build artifact archives by stripping ambient host entropy (clamping file modification timestamps to a canonical `SOURCE_DATE_EPOCH`, normalizing UID/GID to 0, sorting file entries lexicographically, and standardizing permissions to `0644`/`0755`).
4. **Dual-Build Multi-Environment Attestation**: Independent dual-build verification testing that independently compiled bundles across different paths or environments yield identical SHA-256 digests.
5. **Cryptographic Build Receipt**: Emitting execution evidence at `docs/evidence/HERMETIC_BUILD_RECEIPT.json` sealed with SHA-256 signature.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Strict Zero runtime third-party dependencies (`dependencies: {}`) using native Node.js 22.18+ / `node:crypto`.
- **Nix & Bazel Declarative Manifests**: `deploy/nix/flake.nix`, `deploy/nix/default.nix`, `deploy/bazel/WORKSPACE`, `deploy/bazel/BUILD.bazel`.
- **Archive Normalization Engine**: Deterministic TAR/manifest canonicalization stripping timestamps, permissions, and ordering jitter.
- **Reproducibility Verification Engine**: Independent compilation comparison emitting `REPRODUCIBLE_MATCH` or `NON_DETERMINISTIC_DRIFT`.
- **CLI Subcommands**: `toolchain:nix:flake`, `toolchain:bazel:build`, `toolchain:build:normalize`, `toolchain:build:verify`.
- **Evidence Receipt**: `docs/evidence/HERMETIC_BUILD_RECEIPT.json`.
