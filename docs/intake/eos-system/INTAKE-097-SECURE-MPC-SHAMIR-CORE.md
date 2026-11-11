# INTAKE-097: Layer-0 Secure Multi-Party Computation Engine (SPEC-212)

## 1. Context & Motivation

In decentralized multi-agent architectures, privacy-preserving machine learning, collaborative threat intelligence, and confidential voting, multiple autonomous nodes must jointly compute an aggregate function (such as sum, average, threshold comparison, or product) over their private inputs without any party revealing their individual secret data to each other or to a central coordinator.

While Homomorphic Encryption (SPEC-211) handles delegated computation to a single worker, **Secure Multi-Party Computation (SMPC / MPC)** enables peer swarms of $N$ mutual-untrusting participants to collaboratively evaluate circuits with information-theoretic privacy.

Existing external MPC libraries rely on complex C++ native runtimes, multi-megabyte socket daemons, or Python bindings, violating EOS Law V (Zero External Runtime Dependencies).

Glorian requires a self-contained, Layer-0 implementation of:

1. **Shamir's $(k, N)$ Threshold Secret Sharing** over arbitrary Galois/prime finite fields $\mathbb{Z}_p$ using native `BigInt` arithmetic.
2. **Lagrange Interpolation Polynomial Reconstruction** with $O(k^2)$ exact modular inverse calculation.
3. **Local Homomorphic Share Addition & Linear Combination** without network communication.
4. **Interactive Secret-Shared Multiplication via Beaver Multiplication Triples** with zero plaintext leakage.
5. **Share Integrity Attestation & Cheating Detection** using SHA-256 cryptographic commitments.
6. **First-class CLI & MCP Integration** with immutable execution receipts.

## 2. Inviolable Architectural Constraints

- **Zero External Runtime Dependencies (Law V)**: Pure Node 24 strip-only TypeScript using only `node:crypto` and core primitives.
- **Node Ceiling (Law VII)**: Zero modules exceeding 800 lines; types factored into a dedicated `.types.ts` companion file.
- **Exact Finite Field Arithmetic**: Modular arithmetic executed with `BigInt` modulo $p$ ensuring zero precision loss or integer overflow.
- **Information-Theoretic Security**: Any set of fewer than $k$ shares reveals strictly 0 bits of information about the secret.
- **Subpath, CLI & MCP First-Class Export**: Available via `./mpc` subpath, CLI `mpc:*`, and MCP `eos_enterprise_workspace` frontier actions.

## 3. Deliverables

1. `openspec/changes/CHANGE-097-SECURE-MPC-SHAMIR-CORE.md`
2. `openspec/specs/SPEC-212-SECURE-MPC-SHAMIR-CORE.md` (FR-1079..FR-1083, BDD-1079..BDD-1083)
3. `docs/plans/PLAN-097-SECURE-MPC-SHAMIR-CORE.md`
4. `docs/tasks/TASKS-097-SECURE-MPC-SHAMIR-CORE.md`
5. `src/core/eosSecureMpcShamirCore.types.ts` & `src/core/eosSecureMpcShamirCore.ts`
6. `test/eosSecureMpcShamirCore.test.mjs` (BDD-1079..BDD-1083)
7. CLI integration in `bin/commands/cliFrontierMesh.mjs` (`mpc:split`, `mpc:combine`, `mpc:add`, `mpc:multiply`)
8. MCP tool integration in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`
9. Enterprise facade step #24 in `test/eosEnterpriseFacade.test.mjs`
10. Documentation in `docs/DEVELOPER_GUIDE.md` (Módulo 27) and OpenSpec catalog update (207 specs)
