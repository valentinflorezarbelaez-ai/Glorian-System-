# PLAN-107: Implementation Plan for Layer-0 Bulletproofs NIZK Range Proofs (SPEC-222)

## 1. Overview

This plan operationalizes `SPEC-222` and `CHANGE-107` by developing the zero-dependency, constant-size-to-logarithmic Bulletproofs range proof engine in `src/core/eosBulletproofsRangeProofCore.ts`.

## 2. Phases & Milestones

- **Phase 1: Types & Transparent Parameter Setup**:
  - `src/core/eosBulletproofsRangeProofCore.types.ts`: Define domain types for generators, commitments, inner product proofs, range proofs, receipts.
  - Transparent generator derivation for $\vec{g}, \vec{h}$ on secp256k1 via SHA-256 hash-to-curve.
  - Homomorphic Pedersen commitments $V = v \cdot G + \gamma \cdot H$.
- **Phase 2: Inner Product Argument Protocol**:
  - Vector arithmetic in $\mathbb{Z}_n$: dot product, Hadamard product, scalar vector multiplication.
  - Recursive halving: computing $L_k, R_k$ cross-terms and updating generator vectors.
  - Fiat-Shamir challenge sponge.
- **Phase 3: Range Proof Synthesis & Verification**:
  - Bit decomposition: $\vec{a}_L \in \{0, 1\}^m$, $\vec{a}_R = \vec{a}_L - \vec{1}$.
  - Blinding polynomial $t(X) = t_0 + t_1 X + t_2 X^2$.
  - Range proof synthesis: commitments $A, S, T_1, T_2$, scalar evaluations $\tau_x, \mu, \hat{t}$, and inner product argument $(L, R, a, b)$.
  - Verification algorithm: checks polynomial relation $t(x) = \hat{t}$ and multi-exponentiation equality.
- **Phase 4: CLI & MCP Integration**:
  - `bin/commands/cliBulletproofsMesh.mjs` with subcommands `bp:commit`, `bp:prove`, `bp:verify`, `bp:benchmark`.
  - Wire CLI into `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `bp_commit`, `bp_prove`, `bp_verify` into `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
- **Phase 5: Verification & Governance**:
  - Test suite `test/eosBulletproofsRangeProofCore.test.mjs` (BDD-1129..BDD-1133).
  - Enterprise facade test step #34 in `test/eosEnterpriseFacade.test.mjs`.
  - Document Módulo 37 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 217 specs.
  - Quality gates: typecheck, lint, prettier, repo-health (15/15), unitotal audit (100/100).
