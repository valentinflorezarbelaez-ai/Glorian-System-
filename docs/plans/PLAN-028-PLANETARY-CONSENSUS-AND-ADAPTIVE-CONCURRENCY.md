# ARCHITECTURE PLAN & ADR-041: PLANETARY DISTRIBUTED CONSENSUS & ADAPTIVE CONCURRENCY

<!-- Formal Architecture Decision Record (ADR) & Plan -->

## 1. Architectural Plan

```text
 +---------------------------------------------------------------------------------+
 |                           EOS DISTRIBUTED SOVEREIGNTY                           |
 +---------------------------------------------------------------------------------+
        |                                       |                           |
        v                                       v                           v
 [EosTrueTimeBoundedClock]        [EosPlanetaryConsensusEngine]   [EosAdaptiveConcurrencyLimiter]
 - [earliest, latest] Interval    - Monotonic Terms & Quorum      - TCP Vegas RTT Gradient
 - Oscillator Drift Bound (\epsilon) - Leader Leases & Replicated Log - Queue Inflation Detection
 - Commit-Wait Linearizability    - Split-Brain Immunity (Q=N/2+1)- Proactive Load-Shedding
        |                                       |                           |
        +---------------------------------------+---------------------------+
                                            |
                                            v
                      [CLI: bin/eos.mjs & MCP: src/mcp/eosMcpServer.ts]
                                            |
                                            v
                         [CI/CD 7-Stage Strict Gate (0-Deps)]
```

## 2. ADR-041: Google Spanner TrueTime, Quorum Consensus & Netflix Vegas Limiter

### Status

`ACCEPTED` / `IN_PROGRESS`

### Context

Standard web and enterprise backends rely either on wall clocks (which suffer from NTP clock jumps, skew, and failure to order distributed events linearly) or static rate limiters (e.g. fixed token buckets of 1,000 req/s, which either reject legitimate traffic during underutilization or allow servers to drown during backend slowness). Google Spanner solved distributed time without central synchronization via TrueTime uncertainty intervals $[t_{earliest}, t_{latest}]$ and commit-wait. Netflix solved microservice cascading death via adaptive concurrency limiters based on TCP Vegas. Bringing these two paradigms together into EOS System creates the highest tier of distributed engineering.

### Decision

1. **Google Spanner TrueTime Model**: Implement `EosTrueTimeBoundedClock` returning `TimeInterval = { earliest, latest }` with configurable drift $\epsilon$. When committing state, wait until `now().earliest > commitTimestamp` to ensure any subsequent transaction on any node is strictly ordered later in time.
2. **Raft / Paxos Quorum Consensus**: Implement `EosPlanetaryConsensusEngine` with monotonic term numbering, leader heartbeats, and majority voting ($Q = \lfloor N/2 \rfloor + 1$). State changes require quorum consensus before being committed to the deterministic state machine.
3. **Netflix Vegas Adaptive Concurrency Limiter**: Track baseline $RTT_{min}$ and smoothed moving average $RTT$. Compute queue inflation $queue = limit \times (1 - RTT_{min} / RTT)$. If $queue < \alpha$, increase limit by 1; if $queue > \beta$, decrease limit by $\beta$. Shed load proactively with fail-safe status.
4. **Layer-0 Purity**: Use zero external dependencies, relying strictly on Node.js native standard library (`node:crypto`, `node:perf_hooks`).

### Consequences

- **Positive**: Strict distributed linearizability, resilient fail-safe leader failover, and self-tuning traffic protection that adapts to downstream bottlenecks automatically.
- **Negative / Trade-offs**: Commit-wait introduces a deterministic latency equal to $2\epsilon$ (in modern low-drift setups, $\epsilon \approx 1-3\text{ms}$).
