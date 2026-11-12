# SPEC-223: Layer-0 HotStuff Pipelined BFT Consensus Core

## 1. Specification Metadata

- **Specification ID**: `SPEC-223`
- **Change ID**: `CHANGE-108`
- **Title**: Layer-0 HotStuff Pipelined Byzantine Fault Tolerant Consensus Core
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosHotStuffConsensusEngine.ts`
- **Related Specs**: `SPEC-084` (BFT Slashing), `SPEC-206` (Raft Engine), `SPEC-210` (PBFT Consensus), `SPEC-219` (FROST Signatures)

## 2. Mathematical Foundation & Protocol Design

HotStuff provides linear-view-change Byzantine fault tolerance for up to $f < n/3$ Byzantine nodes:

- **Quorum Certificate (QC)**:
  - Formed when $2f + 1$ replicas vote for block $B$ at view $v$.
  - $QC = (v, \text{blockHash}, \text{type}, \text{signatures})$.
- **Pipelined 3-Chain Rule**:
  - A block $B_1$ is committed when there exists a sequence of ancestor blocks $B_1 \leftarrow B_2 \leftarrow B_3$ such that:
    - $B_2$ has $QC_1$ certifying $B_1$, $B_3$ has $QC_2$ certifying $B_2$, and proposal $B_4$ has $QC_3$ certifying $B_3$.
    - Views satisfy $v(B_1) + 1 = v(B_2)$, $v(B_2) + 1 = v(B_3)$.
- **Voting Safety Rule**:
  - Replica $R_i$ votes for proposal $B$ if and only if:
    1. $B$ extends from the block certified by `lockedQC` (Safety Predicate), OR
    2. $B.justify.view > lockedQC.view$ (Liveness Predicate).
- **Linear View Change**:
  - In each view change, replicas send their highest QC (`highQC`) to the new leader.
  - The new leader selects the highest QC among $2f + 1$ reported QCs and creates a proposal extending it.
  - Communication is strictly $O(n)$ messages per view change.

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1134: Block Synthesis and Quorum Certificate Formation

- **Requirement**: The system SHALL synthesize candidate blocks $B = (v, \text{parentHash}, \text{payload}, \text{justify})$ and SHALL aggregate votes from at least $2f + 1$ validator nodes into a verified Quorum Certificate ($QC$).

### FR-1135: Safety and Liveness Voting Predicate

- **Requirement**: The system SHALL enforce the voting predicate on all replicas, accepting proposal $B$ if and only if $B$ extends `lockedQC.node` or $B.justify.view > lockedQC.view$, and SHALL reject any conflicting proposals.

### FR-1136: Pipelined Three-Chain Commit Execution

- **Requirement**: The system SHALL advance consensus state through pipelined phases (Prepare $\to$ Pre-commit $\to$ Commit $\to$ Decide) and SHALL finalize and commit block $B$ upon observing a contiguous 3-chain with consecutive views.

### FR-1137: Linear Pacemaker and Leader Rotation

- **Requirement**: The system SHALL synchronize view advancement using a linear Pacemaker mechanism, rotating the designated leader via deterministic round-robin without exceeding $O(n)$ message exchanges during view change.

### FR-1138: Equivocation Detection and Attested Ledger Receipts

- **Requirement**: The system SHALL detect and flag validator equivocation or double-voting, emit cryptographic slashing receipts, and log all consensus decisions into the SQLite WAL Ledger with SHA-256 integrity digests.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 HotStuff Pipelined BFT Consensus Core

  Scenario: BDD-1134 Quorum Certificate Formation and Multi-Signature Aggregation
    Given a validator cluster of n = 4 nodes (f = 1, quorum = 3)
    When leader proposes block B at view 1 with Genesis justify QC
    And 3 replicas submit valid votes for block B
    Then a valid Quorum Certificate QC1 is aggregated with 3 signatures.

  Scenario: BDD-1135 Voting Safety Predicate and Lock-QC Enforcement
    Given a replica with lockedQC at view 1
    When a conflicting proposal arrives at view 2 with justify view 0
    Then the replica strictly rejects the vote violating the safety predicate.

  Scenario: BDD-1136 Three-Chain Pipelined Commit Rule
    Given a chain of blocks B1 -> B2 -> B3 -> B4 with consecutive views 1, 2, 3, 4
    When Quorum Certificates are assembled for each block in the chain
    Then block B1 transitions to DECIDED and its payload is permanently committed.

  Scenario: BDD-1137 Linear Pacemaker View Change and Leader Rotation
    Given the current view leader fails to propose within timeout
    When 2f + 1 replicas signal view advance to the Pacemaker
    Then view increments to view + 1 with deterministic next leader in O(n) messages.

  Scenario: BDD-1138 Equivocation Slashing and CLI/MCP Dispatch
    Given a malicious validator submitting two distinct votes for view v
    When HotStuff engine analyzes the conflicting vote receipts
    Then the validator is flagged for equivocation and slashed with ledger proof.
```

## 5. Architecture Decision Record (ADR-223)

- **Context**: PBFT consensus creates quadratic network overhead ($O(n^2)$) on view changes, limiting cluster scalability across the 9 fleet repositories.
- **Decision**: Implement HotStuff 3-chain pipelined consensus with linear $O(n)$ view-change complexity and unified Quorum Certificates in pure Layer-0 TypeScript.
- **Alternatives Discarded**:
  - _Standard PBFT_: $O(n^2)$ view-change message complexity causes latency spikes during network jitter.
  - _Tendermint / 2-chain_: Simpler commit rule but lacks the pipelined efficiency and responsiveness of HotStuff.
  - _Raft_: Does not tolerate Byzantine nodes (crash faults only).
- **Consequences**: Enables high-throughput, Byzantine-tolerant consensus with $O(n)$ message complexity and seamless leader rotation across fleet nodes.
