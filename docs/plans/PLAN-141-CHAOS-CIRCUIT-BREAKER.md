# PLAN-141: Chaos Engineering & Circuit Breaker Fault Injection Gateway

## System Resilience & Automated Fault Tolerance (SPEC-279)

---

### 1. Architectural Strategy

- **Layer-0 Pure State Machine (`src/core/eosChaosCircuitBreaker.ts`)**:
  - Implements a deterministic finite state machine with states: `CLOSED`, `OPEN`, `HALF_OPEN`.
  - Sliding ring buffer of call outcomes (`SUCCESS`, `FAILURE`, `SLOW`).
  - Transition criteria:
    - In `CLOSED`: failure rate $> \text{threshold}$ (or slow call rate $> \text{threshold}$) $\rightarrow$ transition to `OPEN`.
    - In `OPEN`: current timestamp $\ge \text{openedAt} + \text{waitDurationInOpenStateMs}$ $\rightarrow$ transition to `HALF_OPEN`.
    - In `HALF_OPEN`: track trial quota (`permittedNumberOfCallsInHalfOpenState`). If all trial calls succeed $\rightarrow$ heal to `CLOSED`. If any fail $\rightarrow$ re-trip to `OPEN`.
- **Chaos Injection Engine**:
  - Evaluates `ChaosPolicy`:
    - `targetServicePattern`: regex or glob matching service/action name.
    - `latencyDelayMs`: injected millisecond delay (sleep via non-blocking Promise timer or timestamp adjustment).
    - `failureProbability`: $p \in [0.0, 1.0]$.
    - `simulatedErrorCode`: e.g. `HTTP_500`, `CONNECTION_RESET`, `TIMEOUT`.
    - `enabled`: boolean flag.
- **CLI Subcommand Delegation**:
  - Dedicated CLI module in `bin/commands/cliChaos.mjs` ($\le 140$ lines).
  - Subcommands `toolchain:chaos:inject`, `toolchain:chaos:circuit`, `toolchain:chaos:reset` wired into `bin/commands/cliDevOps.mjs`.

### 2. File Invariants

- `src/core/eosChaosCircuitBreaker.ts` ($\le 380$ lines).
- `bin/commands/cliChaos.mjs` ($\le 140$ lines).
- `test/eosChaosCircuitBreaker.test.mjs` ($\le 250$ lines).
- Chaos resilience policy in `templates/chaos/glorian-resilience-policy.json`.
