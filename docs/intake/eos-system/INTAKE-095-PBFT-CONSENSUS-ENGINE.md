# INTAKE-095: Layer-0 Practical Byzantine Fault Tolerant (PBFT) Consensus Engine & Replicated State Machine (SPEC-210)

## 1. Context & Motivation

While the Raft Consensus Engine (SPEC-206) provides strong crash-fault tolerance (CFT) with $N = 2f + 1$ majority quorums, modern distributed multi-agent systems and adversarial mesh topologies face non-crash Byzantine threats:

1. Malicious or compromised nodes sending conflicting proposals to different peers (equivocation / double-proposing).
2. Arbitrary message tampering, delayed payloads, or replayed state transitions.
3. Colluding validator subsets attempting to forge state without quorum.

Glorian requires an immediate, production-grade, zero-dependency implementation of Castro & Liskov (1999) **Practical Byzantine Fault Tolerance (PBFT)** combined with modern replicated state machine (FSM) semantics, equivocation slashing receipts, and view-change protocols operating strictly under $N \ge 3f + 1$.

## 2. Inviolable Architectural Constraints

- **Zero External Runtime Dependencies (Law V)**: Pure Node 24 strip-only TypeScript using only `node:crypto` and core primitives.
- **Node Ceiling (Law VII)**: Zero modules exceeding 800 lines; types factored into a dedicated `.types.ts` companion file.
- **Three-Phase Byzantine Quorum**: Formal implementation of `PRE-PREPARE`, `PREPARE`, and `COMMIT` phases requiring $2f + 1$ matching cryptographic attestations.
- **Equivocation Slashing**: Automatic detection of dual conflicting proposals from the primary for the same view and sequence number, emitting tamper-evident SHA-256 slashing receipts.
- **Deterministic Replicated State Machine (FSM)**: Linearizable state transitions applied only upon committed certificates.

## 3. Deliverables

1. `openspec/changes/CHANGE-095-PBFT-CONSENSUS-ENGINE.md`
2. `openspec/specs/SPEC-210-PBFT-CONSENSUS-ENGINE.md` (FR-1069..FR-1073, BDD-1069..BDD-1073)
3. `docs/plans/PLAN-095-PBFT-CONSENSUS-ENGINE.md`
4. `docs/tasks/TASKS-095-PBFT-CONSENSUS-ENGINE.md`
5. `src/core/eosPbftConsensusEngine.types.ts` & `src/core/eosPbftConsensusEngine.ts`
6. `test/eosPbftConsensusEngine.test.mjs` (BDD-1069..BDD-1073)
7. CLI integration in `bin/commands/cliFrontierMesh.mjs` (`pbft:cluster`, `pbft:status`, `pbft:propose`)
8. MCP tool integration in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`
9. Enterprise facade step #22 in `test/eosEnterpriseFacade.test.mjs`
10. Documentation in `docs/DEVELOPER_GUIDE.md` (Módulo 25) and OpenSpec catalog update (205 specs)
