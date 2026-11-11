# CHANGE-095: Layer-0 Practical Byzantine Fault Tolerant (PBFT) Consensus Engine & Replicated State Machine (SPEC-210)

## 1. Intent & Context

- **Intent**: Deliver sovereign Byzantine fault tolerance for distributed multi-agent operations within Glorian System under $N \ge 3f + 1$, surviving arbitrary, malicious, or silent failures without data corruption or split-brain.
- **Spec**: `SPEC-210`
- **ADR**: `ADR-095`
- **Impact Area**: Distributed consensus, Byzantine resilience, replicated state machines, tamper-evident slashing.

## 2. Approach & Architecture

- **Protocol**: 3-Phase Castro-Liskov PBFT state machine (`PRE-PREPARE`, `PREPARE`, `COMMIT`).
- **Quorum Bound**: $2f + 1$ threshold where $f = \lfloor(N - 1) / 3\rfloor$.
- **Detection & Slashing**: Immediate identification of equivocating primary nodes emitting conflicting digests for $(v, n)$, producing immutable SHA-256 slashing evidence.
- **View Change**: Distributed failover to next deterministic primary $p = (v + 1) \pmod N$ backed by $2f + 1$ view-change signatures.
- **Replicated FSM**: Linearizable state mutations executed strictly post-commit, producing verifiable Merkle state roots.

## 3. Compatibility & Constraints

- Zero external runtime npm packages (Law V).
- Subpath export `"./pbft"` and barrel export in `src/core/index.ts`.
- Node ceiling $\le 800$ lines via `eosPbftConsensusEngine.types.ts`.
