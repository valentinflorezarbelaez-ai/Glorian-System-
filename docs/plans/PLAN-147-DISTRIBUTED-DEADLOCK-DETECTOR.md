# Architecture Plan: PLAN-147 — Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor

- **Change Reference**: `CHANGE-147`
- **Spec Reference**: `SPEC-285`
- **Intake Reference**: `INTAKE-147`
- **Target**: `src/core/eosDeadlockDetectionGovernor.ts`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy

### Directed Wait-For Graph Representation

The Wait-For Graph $G = (V, E)$ represents:

- $V = \{ T_1, T_2, \dots, T_n \}$ where each node holds metadata: transaction ID, timestamp, locks held, locks requested.
- $E = \{ (T_i, T_j) \}$ where $T_i$ is waiting for a lock held by $T_j$.

### Cycle Detection Algorithm

Using iterative/recursive DFS with three vertex colors (White = unvisited, Gray = in current DFS stack, Black = completely visited):

- An edge $(u \rightarrow v)$ where $v$ is Gray indicates a back-edge and identifies a directed cycle.
- Traverses all reachable nodes with complexity $O(|V| + |E|)$.

### Deadlock Resolution & Victim Selection

For any detected cycle $C = [T_{k_1}, T_{k_2}, \dots, T_{k_m}]$:

- Victim criteria: $\arg\max_{T \in C}(\text{timestamp})$ (youngest transaction).
- Aborting the victim removes all incoming and outgoing edges for that transaction, breaking the cycle.

### Modular CLI Architecture

To ensure `bin/commands/cliDevOps.mjs` remains well within the 800-line ceiling (current line count: 769, headroom: 31), we create a dedicated modular command handler `bin/commands/cliDeadlock.mjs` and delegate cleanly with under 10 lines added to `cliDevOps.mjs`.
