# CHANGE-197: Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation Engine (PQ-MPC)

## 1. Intent & Scope

Federated analytics and multi-organization telemetry often require computing an aggregate (sum, count, histogram) over data that no single party is allowed to see in the clear. `CHANGE-197` introduces `EosPostQuantumThresholdMpcCore`, a dependency-free reference implementation that combines:

1. **Shamir `T`-of-`N` secret sharing** over `F_q`, `q = 2^61 - 1`.
2. **SHA-256 share commitments** for tamper detection.
3. **BFV-style Ring-LWE encryption** over `Z_q[x]/(x^n + 1)` with vector packing.
4. **Additive homomorphism** (ciphertext addition, public-scalar multiplication).
5. **Threshold decryption** using a coefficient-wise Shamir-shared secret key and Lagrange recombination.
6. **TLA+ Model 79** (`ThresholdSecureAggregation`) verified with TLC.

The engine is explicitly a **reference / educational implementation**; see the scope limitations in `INTAKE-197`.

## 2. Impacted Components

- `src/core/eosPostQuantumThresholdMpc.ts`: core engine.
- `src/core/eosPostQuantumThresholdMpc.types.ts`: domain types.
- `src/core/index.ts`: module exports.
- `bin/commands/cliPostQuantumThresholdMpc.mjs`: CLI subdispatcher (`toolchain:pqmpc:`).
- `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `docs/formal/ThresholdSecureAggregation.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosPostQuantumThresholdMpc.test.mjs` (BDD-1785..1790).

## 3. Risk Assessment

- **Risk 1**: Users mistake the reference engine for production-grade cryptography.
  - _Mitigation_: Every audit receipt and CLI output carries a `securityNotice`; specs and docs state the limitations explicitly.
- **Risk 2**: Noise overflow after many homomorphic operations corrupts decryption.
  - _Mitigation_: With `q = 2^61 - 1`, `t = 65537`, the scaling factor `Δ ≈ 3.5·10^13` leaves a noise margin of roughly `10^11` fresh-ciphertext noise units; additions and small-scalar products stay far below the decryption bound. Scalars are bounded to `< t`.
- **Risk 3**: Aggregate wrap-around modulo `t`.
  - _Mitigation_: Documented; callers must keep `Σ inputs < t` per slot or choose a larger `t`.
