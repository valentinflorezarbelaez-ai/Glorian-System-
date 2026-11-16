# PLAN-175 — Jepsen-Grade Distributed Network Partition & Chaos Simulator

- **Specification**: `SPEC-313`
- **Milestone**: `v77.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`

---

## 1. Architectural Design & System Components

### 1.1 Virtual Topology & Network Engine

- Discrete event queue sorting events by simulated timestamp (virtual microseconds `virtualTime`).
- Peer graph connecting $N$ virtual nodes.
- Partition filter table: evaluates directed edge connectivity `isLinkReachable(sourceId, targetId)`.
- Pseudo-random number generator (PRNG): Linear Congruential Generator (LCG) or 32-bit xorshift parameterized with explicit numeric seed.

### 1.2 Fault Injection Models

- **Symmetric Partition**: Sets of nodes $\{P_1, P_2, \dots\}$. Cross-partition routing returns `false`.
- **Asymmetric Partition**: Unidirectional link severance $A \not\to B$.
- **Packet Loss**: Evaluated via PRNG against threshold $p$.
- **Clock Drift**: Node-local time offset applied to message generation timestamps.

### 1.3 Anti-Entropy Register & State Machine

- Key-Value store per node.
- Each entry stores: `{ key, value, timestamp, nodeOrigin, vectorClock }`.
- Conflict resolution: Last-Write-Wins (LWW) with tie-breaking on lexicographical node ID.
- Anti-entropy sync protocol: round-robin pairwise delta exchange between reachable peers.

### 1.4 Linearizability & Consistency Auditing

- Invariant: Eventual convergence upon healing ($\forall i, j: \text{state}_i = \text{state}_j$).
- Knossos-style operation log tracking:
  - Invocations (`read`, `write`)
  - Completions (`ok`, `fail`)
  - No stale reads after acknowledged writes in healed state.

---

## 2. Inviolable Quality Gates

1. **Zero External Runtime Dependencies**: Standard Node.js only.
2. **File Size Budgets**: $\le 800$ lines with $\ge 12$ lines headroom per file.
3. **Formal Verification (TLA+)**: TLA+ Model 57 checked with TLC.
4. **CLI Parity**: 100% catalog parity, pure `--json` outputs.
5. **Signed Receipt**: `docs/evidence/JEPSEN_DISTRIBUTED_CHAOS_RECEIPT.json`.
