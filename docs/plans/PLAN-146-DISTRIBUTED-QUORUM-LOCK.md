# Architecture Plan: PLAN-146 — Multi-Region Quorum Lease & Distributed Lock Governor

- **Change Reference**: `CHANGE-146`
- **Spec Reference**: `SPEC-284`
- **Intake Reference**: `INTAKE-146`
- **Target**: `src/core/eosDistributedLockGovernor.ts`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy

### Distributed Quorum Mathematics

For a cluster of $N$ nodes:
$$Q = \left\lfloor \frac{N}{2} \right\rfloor + 1$$
Any two quorums $Q_1, Q_2$ intersect in at least one node:
$$|Q_1 \cap Q_2| \ge 1$$
This guarantees split-brain immunity across network partitions.

### Fencing Token Guarantee

Every lease grant assigns $f_{token} = \text{maxToken} + 1$.
Storage write requests downstream verify:
$$\text{write}(f_{token}) \iff f_{token} \ge f_{\text{last\_seen}}$$
If $f_{token} < f_{\text{last\_seen}}$, the write is rejected as a delayed "zombie process" write.

### State Transitions

```
                [ACQUIRE] (Quorum Votes >= Q)
UNLOCKED / EXPIRED ───────────────────────────────> ACQUIRED
        ▲                                              │
        │ [RELEASE] / [TIMEOUT]                        │ [RENEW]
        │                                              ▼
        └───────────────────────────────────────── RENEWED
```

### Modular CLI Architecture

Create `bin/commands/cliDistributedLock.mjs` and delegate cleanly from `bin/commands/cliDevOps.mjs` with minimal line overhead to keep `cliDevOps.mjs` well below 800 lines.
