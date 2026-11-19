# SPEC-346: Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance

## 0. Intent

Monolithic single-agent workflows are brittle against hallucinations, context degradation, and adversarial prompt poisoning. This specification formalizes `EosAgenticSwarmBftCore`, an autonomous multi-agent swarm orchestrator that coordinates heterogeneous agent roles (`ARCHITECT`, `CODER`, `SECURITY_AUDITOR`, `VERIFIER`, `ORCHESTRATOR`) and guarantees architectural safety via a mathematically proven $3f + 1$ Byzantine Fault Tolerant (PBFT) consensus protocol.

Doctrine: **Law I (Specification as Supreme Truth)**, **Law III (Evidence Over Claims)**, and **Law V (Architectural Purity)**.

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO a swarm mission is initialized with $N \ge 4$ agent nodes, EL SISTEMA provisions specialized agent actors (`ARCHITECT`, `CODER`, `SECURITY_AUDITOR`, `VERIFIER`, `ORCHESTRATOR`) and initializes trust scores and cryptographic message envelopes in pure Layer-0 memory.
- **FR-2 (Event-Driven)**: CUANDO an agent proposes an architectural decision or code artifact, EL SISTEMA initiates a 3-phase BFT consensus round (`PRE-PREPARE`, `PREPARE`, `COMMIT`).
- **FR-3 (State-Driven)**: MIENTRAS tallying votes across the swarm, EL SISTEMA enforces quorum threshold $Q = 2f + 1$ (where $f = \lfloor(N - 1)/3\rfloor$), declaring consensus achieved only if affirmative votes meet or exceed $Q$.
- **FR-4 (Error / Unwanted Condition)**: SI an agent submits contradictory votes, ungrounded hallucinations, or corrupted payload digests, ENTONCES EL SISTEMA immediately slashes the agent's trust score, isolates the node with `AGENT_SLASHED`, and recalculates quorum membership.
- **FR-5 (Event-Driven)**: CUANDO `auditAgenticSwarmBft()` executes, EL SISTEMA validates consensus safety, byzantine slashing resilience, quorum mathematical bounds, and emits a cryptographic evidence receipt to `docs/evidence/AGENTIC_SWARM_BFT_RECEIPT.json`.
- **FR-6 (Ubiquitous)**: EL SISTEMA exposes CLI commands `toolchain:swarm:spawn`, `toolchain:swarm:task`, `toolchain:swarm:vote`, `toolchain:swarm:status`, `toolchain:swarm:slash`, and `toolchain:swarm:audit` with clean `--json` machine contracts.

---

## 2. Non-Functional Requirements

- **NFR-1**: 100% pure Layer-0 implementation (`dependencies: {}` in `package.json`). Zero external consensus libraries.
- **NFR-2**: All touched and newly created modules must strictly conform to $\le 800$ lines with $\ge 12$ lines of headroom (SPEC-250).
- **NFR-3**: BFT consensus rounds with $N = 4$ to $N = 16$ agents must complete in $< 15$ milliseconds in-memory.
- **NFR-4**: Mathematical safety guarantee: two conflicting proposals can never both achieve commit quorum if $f < N/3$.

---

## 3. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1855 Multi-Agent Swarm Cluster Provisioning and Role Assignment
  DADO a swarm initialization request with N=4 nodes
  CUANDO spawnSwarm executes
  ENTONCES 4 specialized agents are registered with initial trust scores of 100
  Y the byzantine tolerance threshold is calculated as f=1.

ESCENARIO: BDD-1856 PBFT 3-Phase Consensus Proposal and Preparation
  DADO an active 4-agent swarm cluster
  CUANDO an agent submits a code proposal
  ENTONCES a PRE-PREPARE message is broadcast with SHA-256 payload digest
  Y agents respond with signed PREPARE messages.

ESCENARIO: BDD-1857 Quorum Threshold Enforcement and Artifact Sealing
  DADO a proposal in PREPARE phase receiving 3 affirmative votes (Q=3 out of N=4)
  CUANDO tallyVotes executes
  ENTONCES the round transitions to COMMIT phase
  Y the proposal is sealed with status CONSENSUS_ACHIEVED.

ESCENARIO: BDD-1858 Byzantine Fault Detection and Automatic Agent Slashing
  DADO a rogue agent submitting conflicting votes or corrupted payload hashes
  CUANDO verifyVote executes
  ENTONCES the byzantine anomaly is detected, the agent is slashed with AGENT_SLASHED
  Y the node is excluded from active quorum calculation.

ESCENARIO: BDD-1859 Dynamic Swarm Reconfiguration and Fault Isolation
  DADO a swarm where an agent is slashed
  CUANDO rebalanceSwarm executes
  ENTONCES the quorum threshold adapts to the remaining healthy cluster
  Y pending consensus rounds proceed unhindered.

ESCENARIO: BDD-1860 Full Swarm BFT Audit and Cryptographic Receipt Emission
  DADO the autonomous swarm engine
  CUANDO auditAgenticSwarmBft executes
  ENTONCES all consensus and slashing invariants verify true
  Y a verifiable SHA-256 evidence receipt is written to docs/evidence/AGENTIC_SWARM_BFT_RECEIPT.json.
```
