# PLAN-241: Architecture Decision Record (ADR-171) — Byzantine Quorum Attestation, Cross-Fleet Deterministic Snapshot & Idempotent Verification Gate Governor

## 1. Architectural Context

With `SPEC-305` (FDIR Knowledge Ontology), `SPEC-306` (WASM Bytecode Synthesizer), `SPEC-307` (Autonomous Continuous Reconciliation Loop), and `SPEC-308` (Cross-Fleet Merkle-CRDT State Replication) active in production, Glorian System requires a final Phase 5 consensus sealing layer (`SPEC-379`): a **Byzantine Fault-Tolerant ($3f+1$) Quorum Attestation & Deterministic Epoch Snapshot Governor** (`EosByzantineQuorumGovernorCore`), together with **Idempotent SecDevOps Verification Gate Hardening**.

## 2. Decision: PBFT/HotStuff Quorum Certificates + Equivocation Slasher + Linear Memory Bitmask + Idempotent Receipts

We implement `EosByzantineQuorumGovernorCore` and harden the verification pipeline around four architectural pillars:

1. **Supermajority Quorum Geometry ($N = 3f + 1, Q = \lfloor 2N/3 \rfloor + 1$)**:
   - Validator committees of size $N \ge 4$ tolerate up to $f = \lfloor (N - 1) / 3 \rfloor$ Byzantine actors.
   - Any two quorums of size $Q = \lfloor 2N / 3 \rfloor + 1$ intersect in at least $f + 1$ validators, guaranteeing at least one honest validator in the intersection and preventing split-brain state commits.
2. **Cryptographic Equivocation Detection & Slashing**:
   - Every vote binds `(epochHeight, stateRootHash, crdtConvergenceHash, validatorId)` with a deterministic HMAC-SHA256 cryptographic signature.
   - If a validator submits two distinct `stateRootHash` digests for the same `epochHeight`, `EosByzantineQuorumGovernorCore` immediately transitions the validator to `SLASHED_QUARANTINED`, purges its votes from the active epoch tally, and emits a tamper-evident `EquivocationSlashProof`.
3. **WASM Linear Memory Voter Bitmask Plane**:
   - Uses `WebAssembly.Memory` (backed by `Uint32Array`) to pack validator participation bits into 32-bit words and execute SWAR (SIMD Within A Register) Hamming weight popcount in $O(W)$ words with zero heap allocations.
4. **Idempotent Verification & Receipt Anti-Downgrade Protocol**:
   - `scripts/run-tlc.mjs` compares material verification fields against the existing `docs/evidence/TLC_RECEIPT.json` before writing; preserves an existing `LIVE_LOCAL_TLC` (`VERIFIED`) receipt when running in a Java-less/deferred environment as long as all `.tla`/`.cfg` specs validate; and treats `EPERM`/`EACCES` on receipt persistence as non-fatal when the on-disk receipt is already valid.
   - `scripts/verify-cicd-pipeline.mjs` falls back cleanly when `.cache` or `.eos` directories are read-only in sandboxed environments.

## 3. Rejected Alternatives

- **Alternative A: Simple Majority Quorum ($\lfloor N/2 \rfloor + 1$, Raft-only)**
  - _Rejected_: Tolerates crash faults ($2f + 1$) but fails under arbitrary/Byzantine equivocation where a malicious node votes for two conflicting roots simultaneously.
- **Alternative B: Unconditional Timestamp Overwrite on Verification Receipts**
  - _Rejected_: Causes perpetual working-tree dirty loops (`git status` modified after every `npm test`) and crashes with `EPERM` in read-only sandbox verification contexts.

## 4. Consequences & Guarantees

- **Zero NPM Dependencies**: 100% pure TypeScript utilizing native `node:crypto`, `node:fs`, `node:path`, and `WebAssembly.Memory` (Law V).
- **Idempotent Verification**: Running tests and verification gates leaves the working tree clean when material inputs are unchanged.
- **File Hygiene**: Strict $\le 800$ line limit with $\ge 12$ lines headroom maintained across all modules (`SPEC-250`).
