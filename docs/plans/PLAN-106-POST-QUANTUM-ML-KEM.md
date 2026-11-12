# PLAN-106: Implementation Plan for Layer-0 Post-Quantum ML-KEM Core (SPEC-221)

## 1. Overview

This plan operationalizes `SPEC-221` and `CHANGE-106` by developing the zero-dependency, constant-time NIST FIPS 203 ML-KEM-768 engine in `src/core/eosPostQuantumMlKemCore.ts`.

## 2. Phases & Milestones

- **Phase 1: Types & Mathematical Ring Foundation**:
  - `src/core/eosPostQuantumMlKemCore.types.ts`: Define parameter sets, keypair types, ciphertext types, encapsulation result types.
  - Number Theoretic Transform (NTT / INTT) tables for $\zeta = 17 \pmod{3329}$.
  - Modular reduction routines (Montgomery / Barrett).
- **Phase 2: Sampling & Keccak Extensible Output Functions**:
  - SampleMatrix ($A \in R_q^{k \times k}$) via SHAKE-128 rejection sampling.
  - SamplePolyCBD ($\eta = 2$) via SHAKE-256 bits.
  - Byte compression and decompression ($d_u = 10, d_v = 4$).
- **Phase 3: Protocol Pipeline (K-PKE & ML-KEM)**:
  - `kPkeKeyGen`, `kPkeEncrypt`, `kPkeDecrypt`.
  - `mlKemKeyGen`: Public key $ek$ (1184 B), secret key $dk$ (2400 B).
  - `mlKemEncaps`: Shared secret $K$ (32 B), ciphertext $c$ (1088 B).
  - `mlKemDecaps`: Re-encryption verification and constant-time implicit rejection.
- **Phase 4: CLI & MCP Integration**:
  - `bin/commands/cliMlKemMesh.mjs` with subcommands `keygen`, `encaps`, `decaps`, `benchmark`.
  - Wire CLI into `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
  - Wire MCP actions into `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
- **Phase 5: Verification & Governance**:
  - Full BDD test suite `test/eosPostQuantumMlKemCore.test.mjs`.
  - Enterprise facade test step #33 in `test/eosEnterpriseFacade.test.mjs`.
  - Update `docs/DEVELOPER_GUIDE.md` (Módulo 36).
  - Update `docs/specs/openspec-catalog-index.json` (216 specs).
  - All 15 repo-health checks pass.
