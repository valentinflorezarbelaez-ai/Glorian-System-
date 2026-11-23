# INTAKE-241: Byzantine Quorum Attestation, Cross-Fleet Deterministic Snapshot & Idempotent Verification Gate Governor

**Target Subsystem**: `src/core/eosByzantineQuorumGovernor.ts` & `src/core/eosByzantineQuorumGovernor.types.ts`  
**Governed By**: SPEC-379, CHANGE-241, Commandment I (Supreme Truth), Commandment V (Zero NPM Dependencies)  
**Author**: Valentin Florez Arbelaez & Google Antigravity (Glorian Core Architects)  
**Date**: 2026-11-23  
**Status**: APPROVED & INTAKE COMPLETE

---

## 1. Problem Statement & Motivation

Glorian System's Phase 5 Sovereign Autonomous Architecture has established:

1. `SPEC-305`: `EosFdirOntology` — Bi-temporal semantic graph clinical firewall and orphan/cycle isolation.
2. `SPEC-306`: `EosWasmBytecodeSynthesizer` — Pure W3C WebAssembly binary synthesis and linear memory sandboxing.
3. `SPEC-307`: `EosAutonomousReconciliationLoop` — OODA closed-loop convergence across all 9 fleet repositories.
4. `SPEC-308`: `EosCrdtStateReplicator` — Decentralized Merkle-DAG and Join-Semilattice CRDT state replication.

To complete Phase 5 (`SPEC-379`), the fleet requires a **Byzantine Quorum Attestation & Deterministic Epoch Snapshot Governor** (`EosByzantineQuorumGovernorCore`) paired with **Idempotent Verification Gate Hardening**:

- **Byzantine Supermajority Quorum ($N = 3f + 1, Q = 2f + 1$)**: When distributed CRDT replicas converge on a Merkle state root across the 9 fleet repositories, validator nodes must seal an immutable **Quorum Certificate (QC)** requiring at least $\lfloor \frac{2N}{3} \rfloor + 1$ cryptographic attestations before committing an epoch snapshot.
- **Equivocation Detection & Slashing**: If a compromised or Byzantine validator signs two distinct state roots at the same epoch height ($h$), the governor must immediately detect the double-signature, emit a cryptographic `EquivocationSlashProof`, quarantine the Byzantine validator, and exclude its equivocated votes from quorum tallying.
- **WASM Linear Memory Voter Bitmask & Digest Acceleration**: High-speed quorum bitmask aggregation and epoch state commitment hashing over zero-copy linear memory (`WebAssembly.Memory` / `Uint32Array`) executing in sub-microsecond latency.
- **Idempotent Verification & Receipt Seal Hygiene**:
  - `scripts/run-tlc.mjs` previously overwrote `docs/evidence/TLC_RECEIPT.json` with a fresh `timestampIso` on every verification invocation and downgraded verified `LIVE_LOCAL_TLC` receipts when run in deferred/read-only environments.
  - `scripts/verify-cicd-pipeline.mjs` and `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` required read-only sandbox resilience and tmpdir isolation.
  - `bin/commands/cliCrdtStateReplicator.mjs` required boolean `true` handler return parity with `cliToolchainRouter.mjs`.
  - `docs/projects/registry.json` (`eos-system` `headCommitSha`) and `docs/releases/EOS_FREEZE_GATE_STATUS.md` (`Freeze Pin`) required synchronization to tip.

---

## 2. Scope & Boundaries

- **In Scope**:
  - `src/core/eosByzantineQuorumGovernor.types.ts` (Epoch proposals, validator votes, Quorum Certificates, equivocation slash proofs, audit receipts).
  - `src/core/eosByzantineQuorumGovernor.ts` (Pure TypeScript Layer-0 engine, zero external dependencies).
  - CLI integration: `toolchain:quorum:propose`, `toolchain:quorum:attest`, `toolchain:quorum:slash`, `toolchain:quorum:audit` in `bin/commands/cliByzantineQuorum.mjs` and `bin/commands/cliToolchainRouter.mjs`.
  - Operational fixes in `bin/commands/cliCrdtStateReplicator.mjs`, `scripts/run-tlc.mjs`, `scripts/verify-cicd-pipeline.mjs`, `test/eosToolchainControlPlaneAndTlcLocal.test.mjs`, and `docs/projects/registry.json`.
  - Automated BDD test suite in `test/eosByzantineQuorumGovernor.test.mjs` (`BDD-2065`..`BDD-2070`).
  - Cryptographic receipt at `docs/evidence/BYZANTINE_QUORUM_RECEIPT.json`.
- **Out of Scope**:
  - External npm runtime dependencies (`dependencies: {}` strictly preserved).
  - Adding new `/api/*.js` endpoints (12/12 Vercel Hobby serverless budget strictly preserved).
