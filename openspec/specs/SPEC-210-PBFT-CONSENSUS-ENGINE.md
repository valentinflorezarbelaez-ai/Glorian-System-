# SPEC-210: Layer-0 Practical Byzantine Fault Tolerant (PBFT) Consensus Engine & Replicated State Machine

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-095`
- **Architecture Decision Record**: `ADR-095`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Castro & Liskov (1999) PBFT, EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1069 (Ubiquitous - Byzantine Quorum Sizing & Primary Assignment)

THE SYSTEM SHALL compute the maximum tolerable Byzantine faults as $f = \lfloor(N - 1) / 3\rfloor$ for any cluster of $N \ge 4$ nodes, enforce a supermajority quorum threshold of $2f + 1$, and deterministically assign the primary leader as $p = v \pmod N$ for view $v$.

### FR-1070 (Event-Driven - Three-Phase Consensus Progression)

WHEN a client command is proposed to the primary node in view $v$, THE SYSTEM SHALL:

1. Assign a monotonically increasing sequence number $n$, compute request digest $d = \text{SHA256}(m)$, and broadcast `PRE-PREPARE`.
2. Collect $2f$ matching `PREPARE` messages from distinct replicas to assemble a Prepared Certificate.
3. Broadcast `COMMIT` and collect $2f + 1$ matching commit messages to assemble a Committed-Local Certificate.

### FR-1071 (State-Driven - Replicated State Machine Execution)

WHILE a committed-local certificate is formed for $(v, n, d)$, THE REPLICATED STATE MACHINE SHALL execute the command deterministically against its local state, apply state transformations, and emit a tamper-evident execution receipt with SHA-256 state hash.

### FR-1072 (Unwanted Condition - Equivocation Slashing & Malicious Node Quarantine)

IF the primary or any replica emits two conflicting messages ($d \neq d'$) for the identical view and sequence number $(v, n)$, THEN THE SYSTEM SHALL detect the Byzantine equivocation, quarantine the offending node, slash its validator weight, and emit a tamper-evident slashing receipt.

### FR-1073 (Event-Driven - View Change & Byzantine Leader Failover)

WHEN a timer expires without completing the consensus phases or upon verified primary equivocation, THE BACKUP NODES SHALL broadcast `VIEW-CHANGE` for view $v + 1$, and the designated new primary SHALL broadcast `NEW-VIEW` upon accumulating $2f + 1$ valid view-change certificates.

---

## BDD Scenarios

### BDD-1069: Cluster Initialization, Quorum Sizing, and Deterministic Primary Election

GIVEN a PBFT cluster with 4 distinct validator nodes (Node-0, Node-1, Node-2, Node-3) in View 0
WHEN the cluster status is evaluated
THEN the maximum tolerable Byzantine faults $f$ MUST equal 1
AND the required consensus quorum MUST equal $2f + 1 = 3$
AND Node-0 MUST be elected as the initial deterministic primary ($p = 0 \pmod 4$).

### BDD-1070: Three-Phase Consensus Progression with Honest Majority

GIVEN an active 4-node PBFT cluster with Node-0 as primary
WHEN a valid key-value mutation command `SET user_role = "OPERATOR"` is submitted
THEN Node-0 MUST broadcast a `PRE-PREPARE` message with monotonic sequence number 1
AND all honest backups MUST broadcast corresponding `PREPARE` messages
AND upon collecting 3 prepare votes, nodes MUST broadcast `COMMIT`
AND upon collecting 3 commit votes, the state machine MUST transition and commit the key.

### BDD-1071: Fault Tolerance Under Single Crash/Mute Byzantine Node

GIVEN a 4-node PBFT cluster ($f = 1$)
WHEN Node-3 goes offline, is partitioned, or remains completely silent
AND a new state mutation `SET cluster_mode = "HARDENED"` is submitted to Node-0
THEN the remaining 3 honest nodes (Node-0, Node-1, Node-2) MUST successfully reach consensus
AND the command MUST commit and apply across all active state machines without stalling.

### BDD-1072: Equivocation Detection and Byzantine Slashing

GIVEN a 4-node PBFT cluster
WHEN a Byzantine node broadcasts conflicting proposals ($d_1 \neq d_2$) for the identical $(v=0, n=1)$
THEN the receiving nodes MUST detect the cryptographic equivocation
AND generate a tamper-evident `ByzantineSlashingReceipt` containing both conflicting message digests
AND revoke/quarantine the offending validator node from participating in future quorums.

### BDD-1073: Distributed View-Change Protocol and Primary Failover

GIVEN a 4-node PBFT cluster in View 0 where the primary Node-0 fails or equivocates
WHEN backups timeout and broadcast `VIEW-CHANGE` messages for View 1
THEN upon collecting 3 valid view-change votes, Node-1 ($p = 1 \pmod 4$) MUST assume the primary role
AND broadcast a `NEW-VIEW` message
AND resume normal three-phase consensus processing with full state continuity.
