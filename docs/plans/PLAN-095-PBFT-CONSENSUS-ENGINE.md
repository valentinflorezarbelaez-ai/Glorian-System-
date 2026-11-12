# PLAN-095: Layer-0 Practical Byzantine Fault Tolerant (PBFT) Consensus Engine & Replicated State Machine (SPEC-210)

## 1. Architectural Strategy

- Factoring into:
  - `src/core/eosPbftConsensusEngine.types.ts`: Protocol definitions (`PbftPhase`, `PbftMessage`, `PreparedCertificate`, `CommittedCertificate`, `PbftClusterStatus`, `ByzantineSlashingReceipt`, `FsmReducer`).
  - `src/core/eosPbftConsensusEngine.ts`: `EosPbftNode` and `EosPbftCluster` implementing the 3-phase progression, equivocation auditor, and view-change coordinator.
- Zero dependencies, Node 24 strip-only compliant.

## 2. Phases & Milestones

- **Phase 1**: Types and mathematical bounds ($f = \lfloor(N - 1) / 3\rfloor$, quorum $= 2f + 1$).
- **Phase 2**: Three-phase state machine engine (`PRE-PREPARE` -> `PREPARE` -> `COMMIT`).
- **Phase 3**: Slashing engine for dual-signed conflicting proposals.
- **Phase 4**: View-change protocol with `NEW-VIEW` certificate assembly.
- **Phase 5**: CLI and MCP integrations.
- **Phase 6**: Test suite `test/eosPbftConsensusEngine.test.mjs` verifying BDD-1069..BDD-1073.
- **Phase 7**: Quality gates, OpenSpec catalog update (205 specs), commit & push.
