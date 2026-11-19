# PLAN-218: Architecture Plan for Self-Rebalancing Ephemeral Micro-Thread Work-Stealing Scheduler

## 1. Architectural Overview & Context

- **Spec / Change**: `SPEC-356` / `CHANGE-218`
- **Domain**: Concurrent Work-Stealing Runtime, Cooperative Multitasking, Micro-Task Fabrics
- **Archetype**: Robert Blumofe & Charles Leiserson (Cilk Work-Stealing), Go Runtime (GOMAXPROCS M:N Scheduler), Tokio (Multi-Thread Steal)

---

## 2. Architecture Decisions (ADRs)

### ADR-218-001: Chase-Lev Lock-Free Work-Stealing Deque Algorithm

- **Status**: `APPROVED`
- **Context**: Centralized FIFO/LIFO task queues suffer severe mutex contention under multicore execution.
- **Decision**: Implement the Chase-Lev circular array deque. Each worker thread owns its local deque:
  - `pushBottom(task)`: Executed exclusively by the owner thread with relaxed atomic operations.
  - `popBottom()`: Executed exclusively by the owner thread; if only 1 item remains, uses an atomic Compare-And-Swap (CAS) to arbitrate against concurrent thieves.
  - `stealTop()`: Executed by any idle worker thread; uses CAS to advance the `top` pointer and claim the oldest task (FIFO).
- **Consequences**: Lock-free fast path for owner ($O(1)$ without locking). High throughput and optimal cache locality.

### ADR-218-002: Dynamic Load-Balancing & Starvation-Free Priority Aging

- **Status**: `APPROVED`
- **Context**: Without load balancing, recursive fork-join task structures cause idle worker bubbles and load skew.
- **Decision**: Implement randomized victim selection: an idle worker selects a random peer to steal from. If the victim deque has tasks, it steals a batch or the top item. Micro-tasks record spawn time; tasks waiting longer than the aging threshold are promoted.
- **Consequences**: Maximizes CPU core utilization across all available worker threads with zero starvation.

---

## 3. Worker Thread Architecture Blueprint

```text
+-----------------------------------------------------------------------------------+
| EOS WORK-STEALING SCHEDULER POOL (N Workers: W_0, W_1, ..., W_{N-1})              |
+-----------------------------------------------------------------------------------+
| Worker W_0:                               Worker W_1:                            |
|   +-----------------------------+           +-----------------------------+       |
|   | Chase-Lev Deque             |           | Chase-Lev Deque             |       |
|   | [Top] -> T0 (Oldest / FIFO) |           | [Top] -> (Empty)            |       |
|   |          T1                 |           |                             |       |
|   | [Btm] -> T2 (Newest / LIFO) |           | [Btm]                       |       |
|   +-----------------------------+           +-----------------------------+       |
|     ^ Owner: push/pop Bottom                  ^ Thief: steal Top (CAS)            |
|     |                                         |                                   |
|     +------------------- STEAL TASK 0 --------+                                   |
+-----------------------------------------------------------------------------------+
```
