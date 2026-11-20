# PLAN-232: Architecture Plan & ADR for Deterministic Replay Debugger & MCTS Time-Travel Studio

**Document ID**: `PLAN-232-DETERMINISTIC-REPLAY-DEBUGGER`  
**Specification Target**: `SPEC-370` / `CHANGE-232`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Architectural Design & Topology

```
                  ┌──────────────────────────────────────────────┐
                  │       EosDeterministicReplayDebugger         │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
          Record / Rewind│                                │ Branch Counterfactual
                         ▼                                ▼
       ┌───────────────────────────────┐   ┌───────────────────────────────┐
       │     TrajectoryCheckpointStore │   │      MctsTimeTravelStudio     │
       │ (Monotonic Ticks, State Diffs,│   │ (Tree Nodes, UCT Score,       │
       │  Bit-Exact Snapshot Hashes)   │   │  Reward Functions, Rollouts)  │
       └───────────────┬───────────────┘   └───────────────▲───────────────┘
                       │                                   │
                       ▼                                   │ Checkpoint Target
       ┌───────────────────────────────────────────────────┴───────────────┐
       │            Interactive Time-Slider & Step Scrubber                │
       │ (Step-Forward, Step-Backward, Bit-Exact Restore, Delta Emission)  │
       └───────────────────────────────────────────────────────────────────┘
```

## 2. ADR-232-001: Deterministic Checkpointed Time-Travel with MCTS Branching

### Context

When agents run multi-step code synthesis, test execution, or deployment scripts, a single wrong decision at step $K$ ruins the run. Restarting the entire workflow wastes large amounts of compute and tokens. Furthermore, agents have no way to explore alternative decisions ("what if I used an async mutex instead?") without discarding the initial run.

### Decision

Implement a pure Layer-0 deterministic replay debugger:

1. **Execution Checkpoints**: Capture deep-frozen state snapshots at each action step indexed by monotonic tick $t \in [0, N]$.
2. **Deterministic Rewind**: Support `rewindTo(tick)` restoring state snapshot in $O(1)$ from memory.
3. **MCTS Counterfactuals**: Support `createBranch(parentTick, alternativeAction)` producing an isolated branch node with its own child trajectory.
4. **UCT Scoring**: Compute Upper Confidence Bound for Trees:
   $$UCT(v) = \frac{Q(v)}{N(v)} + c \sqrt{\frac{\ln N(parent)}{N(v)}}$$
   to balance exploitation of successful trajectories with exploration of new branches.

### Consequences

- **Positive**: Sub-second time-travel debugging; zero wasted re-execution; exploration of alternative fixes; verifiable receipts.
- **Negative / Trade-offs**: In-memory snapshot storage scales with trajectory length; mitigated by bounded capacity pruning of intermediate non-decision states.

## 3. Rejected Alternatives

- **OS-Level Process Forking**: Rejected due to Windows incompatibility, high memory overhead, and violation of Layer-0 portability.
- **Git Commit per Step**: Rejected due to filesystem disk I/O latency ($> 100\text{ ms}$ per commit).
