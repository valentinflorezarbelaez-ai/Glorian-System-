# CHANGE-166: Single Executable Applications (SEA) Automated Binary Distribution

- **Change ID**: `CHANGE-166`
- **Spec Reference**: `SPEC-304`
- **Tier**: Binary Distribution, Standalone Runtime & Post-Quantum Code Signing (Phase 4.5)
- **Status**: `PROPOSED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T10:02:00Z

---

## 1. Intent & Scope

Implement Phase 4.5 of the Master Engineering Roadmap (`ROADMAP.md`): Single Executable Applications (SEA) Automated Binary Distribution Engine, introducing **SPEC-304**.
The engine governs:

1. Target architecture matrices for 5 standard deployment platforms (`linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`, `win32-x64`).
2. Deterministic SEA configuration generation and blob verification (`sea-config.json`, `NODE_SEA_FUSE`).
3. Dual cryptographic signing binding Ed25519 classical root-of-trust with post-quantum ML-DSA signature envelopes.
4. Packaging of self-contained distribution bundles with checksum verification and SLSA-compliant provenance.
5. Emitting cryptographic proof receipts at `docs/evidence/SEA_BINARY_RECEIPT.json`.

---

## 2. Delta Specification Summary

### Added Modules

- `src/core/eosSingleExecutableDistributionGovernor.types.ts`: Type interfaces for target platforms, binary manifests, SEA configs, signing bundles, and audit receipts.
- `src/core/eosSingleExecutableDistributionGovernor.ts`: Core governor implementing cross-platform matrix validation, SEA blob generation, dual code signing, bundle verification, and receipt emission.
- `bin/commands/cliSeaDistribution.mjs`: CLI dispatcher for `toolchain:sea:matrix`, `toolchain:sea:bundle`, `toolchain:sea:sign`, and `toolchain:sea:audit`.
- `test/eosSingleExecutableDistributionGovernor.test.mjs`: Verification of BDD-1599..BDD-1604.

### Modified Files

- `src/core/index.ts`: Re-export SEA governor and types.
- `bin/commands/cliToolchainRouter.mjs`: Register `toolchain:sea:` prefix.
- `bin/commands/cliHelpCatalog.mjs`: Document `toolchain:sea:*` commands.
- `docs/DEVELOPER_GUIDE.md`: Update CLI command parity count from 451 to 455.
- `docs/evidence/SEA_BINARY_RECEIPT.json`: Generated audit receipt.
