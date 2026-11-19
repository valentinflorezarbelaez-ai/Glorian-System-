# PLAN-208: Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance (`SPEC-346`)

- **Change ID**: `CHANGE-208`
- **Spec ID**: `SPEC-346`
- **Status**: `PLAN_APPROVED`
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & ADRs

### ADR-208-001: Pure Layer-0 In-Memory PBFT Consensus vs External Distributed Consensus

- **Context**: Autonomous swarms inside Glorian System need ultra-low latency consensus ($< 15$ms) across local agent processes without requiring external ZooKeeper, etcd, or Tendermint daemons.
- **Decision**: Implement a pure TypeScript 3-phase Practical Byzantine Fault Tolerance (PBFT) consensus engine (`PRE-PREPARE`, `PREPARE`, `COMMIT`) with cryptographic SHA-256 envelope hashing and deterministic vote tallying.
- **Alternatives Rejected**:
  - `etcd` / `consul`: Rejected due to external network infrastructure requirements violating sovereign self-containment.
  - Naive majority voting (50% + 1): Rejected because standard majority fails under byzantine attacks (adversarial or poisoned agents can equivocate and cause split-brain commits).
- **Consequences**: Provable byzantine fault tolerance for up to $f = \lfloor(N - 1)/3\rfloor$ faulty nodes, zero dependencies, $< 15$ms consensus rounds.

### ADR-208-002: Slashing Penalties & Fault Quarantine

- **Context**: In an autonomous multi-agent cluster, hallucinating or compromised agents must not only be outvoted, but actively penalized and quarantined to prevent continuous voting attacks.
- **Decision**: Track agent trust scores ($0..100$). Any agent caught equivocating (voting twice on different digests in the same round) or submitting corrupted hashes receives an immediate $-50$ penalty and is quarantined upon reaching $\le 20$.
- **Consequences**: Immediate isolation of malicious or hallucinating nodes.

---

## 2. Component Design & Interfaces

- `src/core/eosAgenticSwarmBft.types.ts`:
  - `AgentRole`: `'ARCHITECT' | 'CODER' | 'SECURITY_AUDITOR' | 'VERIFIER' | 'ORCHESTRATOR'`
  - `AgentNode`: `id`, `role`, `trustScore`, `status`, `publicKey`, `createdAt`
  - `ConsensusPhase`: `'PRE_PREPARE' | 'PREPARE' | 'COMMIT' | 'FINALIZED' | 'FAILED'`
  - `ProposalPayload`: `id`, `authorId`, `proposalType`, `data`, `digest`
  - `VoteEnvelope`: `roundId`, `phase`, `voterId`, `proposalDigest`, `decision`, `signature`
  - `ConsensusRound`: `roundId`, `phase`, `proposal`, `prepares`, `commits`, `quorumThreshold`, `status`
  - `SwarmAuditReceipt`: `spec`, `timestamp`, `totalAgents`, `activeQuorum`, `consensusPassed`, `slashingVerified`, `allPassed`, `sha256`

- `src/core/eosAgenticSwarmBft.ts`:
  - `createSwarmCluster(nodeCount?: number): EosAgenticSwarmCluster`
  - `spawnAgent(role: AgentRole, id?: string): AgentNode`
  - `submitProposal(cluster, proposal): ConsensusRound`
  - `castVote(cluster, vote): boolean`
  - `tallyVotes(cluster, roundId): ConsensusPhase`
  - `slashAgent(cluster, agentId, reason: string): boolean`
  - `auditAgenticSwarmBft(root?: string): SwarmAuditReceipt`
