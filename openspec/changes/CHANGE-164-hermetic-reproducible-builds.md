# CHANGE-164: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)

- **Change ID**: `CHANGE-164`
- **Spec Reference**: `SPEC-302`
- **Tier**: Hermetic Infrastructure, Reproducible Builds & Container Sandboxing (Phase 4.3)
- **Status**: `PROPOSED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:36:00Z

---

## 1. Intent & Scope

Implement Phase 4.3 of the Master Engineering Roadmap (`ROADMAP.md`): Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers), introducing **SPEC-302**.
The governor eliminates ambient host non-determinism, standardizes build manifests via declarative Nix Flakes (`deploy/nix/flake.nix`) and Bazel container rules (`deploy/bazel/BUILD.bazel`), normalizes build archive byte streams (`SOURCE_DATE_EPOCH`, sorted entries, unified permissions), verifies bit-for-bit reproducibility across independent multi-environment builds, and generates cryptographic audit receipts at `docs/evidence/HERMETIC_BUILD_RECEIPT.json`.

---

## 2. Delta Specification Summary

### Added Modules

- `deploy/nix/flake.nix`: Declarative Nix Flake pinning nixpkgs, Node.js 22.18+, and hermetic devshell/package outputs.
- `deploy/nix/default.nix`: Classic Nix derivation for reproducible compilation.
- `deploy/bazel/WORKSPACE`: Declarative Bazel workspace pinning rules_nodejs and container toolchains.
- `deploy/bazel/BUILD.bazel`: Hermetic build target definition with zero-network sandboxing.
- `src/core/eosHermeticReproducibleBuildGovernor.types.ts`: Type definitions for build manifests, archive entries, normalization options, reproducibility verification results, and audit receipts.
- `src/core/eosHermeticReproducibleBuildGovernor.ts`: Core governor executing manifest generation, byte-level archive normalization, and multi-build reproducibility assertions.
- `bin/commands/cliHermeticBuild.mjs`: CLI subdispatcher for `toolchain:nix:*`, `toolchain:bazel:*`, and `toolchain:build:*`.
- `test/eosHermeticReproducibleBuildGovernor.test.mjs`: Full test suite covering BDD-1587..BDD-1592.
- `docs/evidence/HERMETIC_BUILD_RECEIPT.json`: Cryptographic verification receipt.

### Modified Modules

- `bin/commands/cliToolchainRouter.mjs`: Add lazy dispatchers for `toolchain:nix:`, `toolchain:bazel:`, `toolchain:build:`.
- `bin/commands/cliHelpCatalog.mjs`: Register 4 new CLI commands (`toolchain:nix:flake`, `toolchain:bazel:build`, `toolchain:build:normalize`, `toolchain:build:verify`).
- `docs/DEVELOPER_GUIDE.md`: Document CLI commands in developer guide.
- `src/core/index.ts`: Re-export types and engine.
- `IMPLEMENTATION_AUTHORIZATION.md`: Record Level 3 authorization.

---

## 3. Invariants & Guardrails

- **Law V**: Zero runtime third-party dependencies (`dependencies: {}`) using native Node.js 22.18+ / `node:crypto`.
- **SPEC-250**: File line ceiling $\le 800$ lines with $\ge 12$ lines of headroom.
- **Vercel Hobby Plan Limits**: Strictly 12/12 serverless functions in `/api/`.
- **Command Parity**: 100.00% parity verified by `hygiene:audit`.
