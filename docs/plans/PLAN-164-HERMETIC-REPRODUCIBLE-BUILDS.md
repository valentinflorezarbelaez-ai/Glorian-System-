# PLAN-164: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)

- **Plan ID**: `PLAN-164`
- **Change ID**: `CHANGE-164`
- **Spec Reference**: `SPEC-302`
- **Tier**: Hermetic Infrastructure, Reproducible Builds & Container Sandboxing (Phase 4.3)
- **Status**: `APPROVED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:36:00Z

---

## 1. Architectural Strategy & ADRs

### ADR-164-01: Declarative Hermetic Toolchain Pinning (Nix Flakes & Bazel Workspace)

- **Context**: Build machine variance (different patch releases of Node.js, different Linux distros, varying libc or glibc versions) is the primary cause of build drift and "works on my machine" failures.
- **Decision**: Declare pure hermetic definitions:
  - `deploy/nix/flake.nix`: Pins nixpkgs commit hash, Node.js 22.18+, sets `SOURCE_DATE_EPOCH`, and creates a devshell and derivations.
  - `deploy/bazel/BUILD.bazel`: Uses Bazel's action sandbox with `--sandbox_default_allow_network=false` to enforce zero network access during compilation.
- **Alternatives Considered & Rejected**:
  - _Installing Docker daemon containers directly in CI_: Rejected because Docker images often contain unpinned rolling base tags (`node:alpine` or `node:latest`) which mutate over time and lack cryptographic bit-for-bit reproducibility guarantees.

### ADR-164-02: Zero-Network Build Sandbox & Bit-for-Bit Determinism Verification

- **Context**: If a build step accesses the network, it can be poisoned by external dependency mirrors, CDN mutations, or compromised upstream artifacts.
- **Decision**: In both Bazel configurations and the TypeScript verification governor, assert zero network socket initialization during build passes. Independent build iterations are verified against each other in isolated environments to mathematically confirm identical bit outputs.

### ADR-164-03: Canonical Archive Normalization (SOURCE_DATE_EPOCH & Permissions)

- **Context**: Standard archive utilities (`tar`, `zip`) capture ambient metadata such as file creation/access/modification timestamps, local file system permissions, and non-deterministic directory traversal order.
- **Decision**: Implement a pure Layer-0 canonical normalization engine:
  - Clamp timestamps to `SOURCE_DATE_EPOCH` (defaulting to canonical Unix timestamp `1700000000`).
  - Normalize file permissions (`0644` for data/source files, `0755` for executables/directories).
  - Strip UID/GID and uname/gname (normalize to 0/root).
  - Lexicographically sort directory entries before hashing or serialization.

---

## 2. Component Layout & Module Structure

```text
deploy/
  ├── nix/
  │   ├── flake.nix                               (~40 lines)  -> Declarative Nix Flake
  │   └── default.nix                             (~30 lines)  -> Classic Nix derivation
  └── bazel/
      ├── WORKSPACE                               (~25 lines)  -> Bazel workspace declaration
      └── BUILD.bazel                             (~35 lines)  -> Hermetic build targets

src/core/
  ├── eosHermeticReproducibleBuildGovernor.types.ts (~110 lines) -> Manifest, Normalization, Verification types
  └── eosHermeticReproducibleBuildGovernor.ts       (~350 lines) -> Core normalization & reproducibility engine

bin/commands/
  └── cliHermeticBuild.mjs                        (~160 lines) -> Subcommands (flake, bazel, normalize, verify)

test/
  └── eosHermeticReproducibleBuildGovernor.test.mjs (~200 lines) -> Tests for BDD-1587..BDD-1592

docs/evidence/
  └── HERMETIC_BUILD_RECEIPT.json                 (~15 lines)  -> Verification receipt
```

---

## 3. Invariants & Guardrails

- **Law V**: Zero runtime third-party dependencies (`dependencies: {}`) using Node.js built-in `node:crypto`.
- **SPEC-250**: Each module must strictly maintain $\le 800$ lines with $\ge 12$ lines of headroom.
- **Fail-Closed Verification**: Any single-bit discrepancy produces `NON_DETERMINISTIC_DRIFT` and aborts release sealing.
