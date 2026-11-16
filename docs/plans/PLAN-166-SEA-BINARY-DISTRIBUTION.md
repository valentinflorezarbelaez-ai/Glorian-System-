# PLAN-166: Single Executable Applications (SEA) Automated Binary Distribution

- **Plan ID**: `PLAN-166`
- **Spec Reference**: `SPEC-304`
- **Change Reference**: `CHANGE-166`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T10:02:00Z
- **Status**: `APPROVED`

---

## 1. Architectural Overview

The Single Executable Application (SEA) distribution engine enables compiling the pure TypeScript/JavaScript control plane of Glorian System into a standalone single executable per platform.

```
┌────────────────────────────────────────────────────────────────────────┐
│               EosSingleExecutableDistributionGovernor                  │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │ Target Platform Matrix│              │    SEA Configuration      │  │
│  │ linux-x64, darwin-arm │ ───────────► │     sea-config.json       │  │
│  │ win32-x64, linux-arm  │              │    NODE_SEA_FUSE (ON)     │  │
│  └───────────────────────┘              └─────────────┬─────────────┘  │
│                                                       │                │
│                                         ┌─────────────▼─────────────┐  │
│                                         │    Dual Code Signer       │  │
│                                         │  • Ed25519 Classical RoT  │  │
│                                         │  • ML-DSA Post-Quantum    │  │
│                                         └─────────────┬─────────────┘  │
│                                                       │                │
│                                         ┌─────────────▼─────────────┐  │
│                                         │ Distribution Bundle &     │  │
│                                         │ In-Toto Attestation       │  │
│                                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision Records (ADRs)

### ADR-166-1: Native Node.js SEA vs External Bundlers (Pkg / Nexe / Bun)

- **Context**: Several third-party tools package Node.js scripts into executables (e.g. `pkg`, `nexe`, or using Bun's compiler).
- **Decision**: Adopt native Node.js 22.18+ / 24+ SEA (`node --experimental-sea-config`) and zero-dependency injection tooling.
- **Alternatives Rejected**:
  - `pkg`: Deprecated by Vercel; bundles outdated Node.js runtimes; introduces external npm dependencies violating Law V.
  - `nexe`: Requires local C++ compilation toolchains on target machines; unmaintained.
  - `bun build --compile`: Requires Bun runtime, breaking Glorian System's native Node.js 22.18+ requirement.
- **Consequences**: Pure zero runtime dependency compliance (Law V), zero security supply-chain surface, and direct compatibility with Node.js LTS updates.

### ADR-166-2: Dual Signing (Ed25519 + Post-Quantum ML-DSA Metadata)

- **Context**: Traditional RSA/ECDSA signatures are vulnerable to Shor's algorithm on cryptanalytically relevant quantum computers (CRQC).
- **Decision**: Sign binaries with a hybrid/dual strategy: Ed25519 for current OS loader validation and ML-DSA-65 metadata for quantum-resistant provenance verification.
- **Consequences**: Forward-compatible security adhering to NIST FIPS 204 post-quantum standards while maintaining instant verification on current hardware.

---

## 3. Implementation Plan & File Layout

1. `src/core/eosSingleExecutableDistributionGovernor.types.ts`: Interface definitions.
2. `src/core/eosSingleExecutableDistributionGovernor.ts`: Main implementation ($\le 800$ lines, $\ge 12$ lines headroom).
3. `bin/commands/cliSeaDistribution.mjs`: CLI commands.
4. `test/eosSingleExecutableDistributionGovernor.test.mjs`: Test suite covering BDD-1599..BDD-1604.
