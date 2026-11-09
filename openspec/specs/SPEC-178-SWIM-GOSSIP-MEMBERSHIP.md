# SPEC-178: SWIM Gossip Membership Protocol

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

An EOS fleet must detect node failures quickly and correctly even under network partitions, where a naive heartbeat scheme would falsely evict healthy-but-partitioned members. The `eosGossipMembership` Layer-0 module implements the SWIM failure-detection model popularized by Argo's SWIM implementation and by Cassandra's gossip-based membership: members move through an `ALIVE → SUSPECT → FAILED` state machine, and a direct-ping failure is first corroborated through an indirect ping-req probe via another member before the target is declared suspect.

Failure detection is expressed as discrete, deterministic rounds. Each call to `round()` advances a monotonic tick, probes every non-failed member, updates its last-direct-ping tick, and escalates members that remain unreachable across `confirmRounds` consecutive suspicions to `FAILED`. Anti-entropy is provided by `applyIndirect`, which merges externally observed states only when they carry a strictly higher incarnation number.

The module honours Law V (Zero External Runtime Dependencies): it depends only on `pureSha256`, `deepFreeze` and `assertPrecondition` from `src/core/eosKernelPrimitives.ts` and uses a string-literal union for the member state. The transport is injected as a pure interface, so the protocol is fully testable without real sockets.

## 2. Functional Requirements (EARS Syntax)

- **FR-871 (Ubiquitous - Seeded Membership Initialisation)**: `The system shall require at least two seed peers, initialise each of them as ALIVE at incarnation 1, and advance a monotonic round counter on every gossip round.`

- **FR-872 (Event-Driven - Direct Ping Liveness)**: `WHEN a round probes a member and the direct ping succeeds, the system shall refresh that member's last-direct-ping tick and, if it was SUSPECT, restore it to ALIVE.`

- **FR-873 (Event-Driven - Indirect Ping Rescue)**: `WHEN a direct ping fails, the system shall attempt ping-req probes through the remaining members and shall keep the target ALIVE if any proxy successfully reaches it.`

- **FR-874 (State-Driven - Suspect Then Failed Escalation)**: `WHILE a member stays unreachable across consecutive rounds, the system shall transition it from ALIVE to SUSPECT on the first failed round and, once confirmRounds have elapsed since suspicion, escalate it to FAILED.`

- **FR-875 (Event-Driven - Anti-Entropy Merge)**: `WHEN applyIndirect is called with an incarnation strictly greater than the stored one, the system shall adopt the external state and return true; otherwise it shall reject the update and return false, registering previously unknown members on first observation.`

- **FR-876 (Ubiquitous - Deterministic Membership Snapshot)**: `The system shall expose a deterministic snapshot that partitions members into sorted alive, suspect and failed lists together with a SHA-256 fingerprint over (tick, alive, suspect, failed).`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-871 Healthy Members Remain ALIVE Across Rounds
  GIVEN a membership seeded with peers ["a","b","c"] and a transport where ping and pingReq always succeed
  WHEN three full gossip rounds are executed
  THEN the snapshot lists exactly ["a","b","c"] as ALIVE
  AND the failed list is empty

SCENARIO: BDD-872 Unreachable Member Escalates SUSPECT Then FAILED
  GIVEN a membership seeded with peers ["a","b","c"] and confirmRounds = 2
  AND a transport where the target "b" is unreachable by both ping and pingReq
  WHEN the first round runs
  THEN "b" is in state SUSPECT
  AND after two further rounds without recovery "b" is escalated to FAILED

SCENARIO: BDD-873 Indirect Ping Rescues a Partitioned Member
  GIVEN a membership where the direct ping to "b" fails but a proxy can reach "b"
  WHEN a gossip round runs
  THEN the indirect ping-req rescue keeps "b" in state ALIVE

SCENARIO: BDD-874 Anti-Entropy Merge Honours Incarnation Ordering
  GIVEN a membership seeded with peers ["a","b","c"]
  WHEN applyIndirect is called for "a" with a state change and an incarnation not greater than the stored one
  THEN the update is rejected and the method returns false
  AND calling applyIndirect with a strictly higher incarnation is accepted, applies the new state and returns true
```

## 4. Architecture Decision Records (ADRs)

- **ADR-178-1: Injected Transport Keeps the Protocol Pure and Socketless**

  - _Context_: Real UDP/TCP probing would make membership tests non-deterministic and would pull in external networking concerns.
  - _Decision_: The protocol depends on an abstract `GossipTransport` interface (`ping`, `pingReq`) that the host supplies; the engine itself performs no I/O.
  - _Consequence_: Deterministic, dependency-free unit testing of failure detection and rescue, at the cost of leaving transport timing to the caller.

- **ADR-178-2: Monotonic Incarnation Numbers for Anti-Entropy Conflict Resolution**
  - _Context_: Concurrent gossip messages can carry conflicting views of the same member, and timestamp-free last-writer-wins would flap.
  - _Decision_: `applyIndirect` only accepts a state change when the incoming incarnation is strictly greater than the stored incarnation.
  - _Consequence_: Convergent, replay-safe membership state, with the requirement that members monotonically increment their incarnation on self-repair.

## 5. Atomic Task DAG

1. [x] **TASK-178-1**: Author this SPEC (EARS + BDD) formalising the SWIM state machine and incarnation ordering.
2. [x] **TASK-178-2**: Implement `EosGossipMembership` in `src/core/eosGossipMembership.ts` (rounds, direct/indirect probing, suspect/failed escalation, anti-entropy merge, snapshot, fingerprint).
3. [x] **TASK-178-3**: Add the `node:test` suite covering every BDD scenario (healthy, escalation, rescue, incarnation merge) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-178-4**: Verify Layer-0 purity (zero external dependencies) and deterministic fingerprints across identical input sequences.
