# CHANGE-241: Byzantine Quorum Attestation, Cross-Fleet Deterministic Snapshot & Idempotent Verification Gate Governor

## Metadata

- **Change ID**: `CHANGE-241`
- **Specification**: `SPEC-379`
- **Scope**: Glorian Byzantine Quorum & Verification Hygiene Plane (`src/core/eosByzantineQuorumGovernor.ts`, `scripts/run-tlc.mjs`, `scripts/verify-cicd-pipeline.mjs`)
- **Status**: `AUTHORIZED`
- **Classification**: Byzantine Fault Tolerance / Quorum Certificates / Slashing / WASM Linear Memory / Idempotent SecDevOps Gates

## 1. Intent & Context

Crown Phase 5 of Glorian System by coupling the Cross-Fleet Merkle-CRDT State Replicator (`SPEC-308`) and Autonomous Reconciliation Loop (`SPEC-307`) with a **Byzantine Fault-Tolerant ($3f+1$) Quorum Attestation & Epoch Snapshot Governor** (`EosByzantineQuorumGovernorCore`), while sealing operational verification idempotency across the 7-stage SecDevOps pipeline.

## 2. Technical Scope

1. **Supermajority Quorum Certificate ($Q = \lfloor 2N/3 \rfloor + 1$) Synthesis**:
   - Deterministic calculation of Byzantine fault tolerance threshold $f = \lfloor (N - 1) / 3 \rfloor$ and supermajority quorum $Q = 2f + 1$ (or $\lfloor 2N/3 \rfloor + 1$).
   - Cryptographic HMAC-SHA256 / Ed25519-compatible vote signing and verification over `(epochHeight, fleetMerkleRoot, crdtConvergenceHash, validatorId)`.
2. **Equivocation Detection & Byzantine Slashing**:
   - Real-time detection of conflicting votes by the same validator at identical `epochHeight`.
   - Automatic emission of an immutable `EquivocationSlashProof`, quarantine of the offending validator, and exclusion of equivocated votes from quorum formation.
3. **WASM Linear Memory Bitmask & Commitment Acceleration**:
   - Zero-copy linear memory (`WebAssembly.Memory` / `Uint32Array`) voter participation bitmask aggregation and popcount calculation with sub-microsecond execution latency.
4. **Idempotent Verification & Control-Plane Hygiene**:
   - Harden `scripts/run-tlc.mjs` so existing `LIVE_LOCAL_TLC` (`VERIFIED`) receipts are never downgraded in deferred environments and unchanged runs preserve `timestampIso` without dirtying git status or failing on read-only mounts.
   - Isolate `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` receipt writes via `os.tmpdir()` and make `scripts/verify-cicd-pipeline.mjs` resilient in read-only sandbox environments.
   - Fix `bin/commands/cliCrdtStateReplicator.mjs` to return `true` upon command dispatch.
5. **Toolchain CLI Integration (`471 -> 475` Commands)**:
   - `toolchain:quorum:propose`: Proposes a deterministic cross-fleet epoch snapshot across the 9 fleet repositories.
   - `toolchain:quorum:attest`: Collects validator votes and seals a $2f+1$ Quorum Certificate.
   - `toolchain:quorum:slash`: Simulates and isolates Byzantine double-signing equivocation with cryptographic slash proof.
   - `toolchain:quorum:audit`: Audits the full BFT quorum pipeline and emits `docs/evidence/BYZANTINE_QUORUM_RECEIPT.json`.
6. **Quality & Test Gates**:
   - BDD test suite (`test/eosByzantineQuorumGovernor.test.mjs`, `BDD-2065`..`BDD-2070`).
   - Line limit budget $\le 800$ lines, min headroom $\ge 12$ lines (`SPEC-250`).
