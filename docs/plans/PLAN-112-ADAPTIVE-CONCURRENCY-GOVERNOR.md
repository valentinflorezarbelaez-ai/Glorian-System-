# PLAN-112: Distributed Adaptive Concurrency Control & Priority-Tier Load Shedding

## 1. Architecture Decision Record (ADR-112)

### Context

Static concurrency thresholds create dangerous instability in distributed systems. Under unexpected latency spikes, in-flight work accumulates, causing queue explosion, GC exhaustion, and cascading failure. Netflix's Vegas algorithm applies Little's Law ($\text{Concurrency} = \text{Throughput} \times \text{Latency}$) to continuously discover the optimal inflight capacity by comparing the minimum observed baseline latency ($RTT_{\text{baseline}}$) against the moving average ($RTT_{\text{actual}}$). When combined with CoDel queue delay bounding and multi-tier priority shedding, the system achieves self-tuning stability under extreme load.

### Decision

Implement `EosAdaptiveConcurrencyGovernor` in pure TypeScript Layer 0:

1. **Exponential Smoothing RTT Estimator**: Track current RTT using EMA ($\alpha = 0.2$) and decay the baseline minimum RTT over time to accommodate genuine infrastructure changes.
2. **Vegas Gradient Computation**: Calculate $\text{Gradient} = \frac{RTT_{\text{baseline}}}{RTT_{\text{current}}}$, clamp between $[0.1, 1.0]$, and adjust limits using additive queue headroom ($\beta = 3$).
3. **Multi-Tier Priority Admission**: Implement 4 tiers (`CRITICAL`, `HIGH`, `NORMAL`, `BEST_EFFORT`) with reserved headroom multipliers.
4. **CoDel Queue Wait Check**: Fail-fast when queue wait time exceeds `maxQueueDelayMs` (default: 15ms).

### Rejected Alternatives

- **Alternative A: Static Maximum Concurrency Configuration**
  - _Why Rejected_: Cannot adapt to fluctuating downstream latencies; causes catastrophic bufferbloat under load.
- **Alternative B: Pure Token Bucket Rate Limiting Without Latency Feedback**
  - _Why Rejected_: Rate limiters measure request frequency per second, not backend execution duration. If requests take 10x longer, a token bucket allows 10x more concurrent work to pile up, causing out-of-memory crashes.
- **Alternative C: Third-Party External Resiliency Libraries (e.g., resilience4j / hystrix-like npm packages)**
  - _Why Rejected_: Violates Law V (Architectural Purity) and Law IV (Layer 0 Purity) by introducing external runtime dependencies.

---

## 2. Data Contracts & Interfaces

```typescript
export type PriorityTier = "CRITICAL" | "HIGH" | "NORMAL" | "BEST_EFFORT";

export interface ConcurrencyGovernorConfig {
  readonly minLimit?: number; // default: 10
  readonly maxLimit?: number; // default: 200
  readonly initialLimit?: number; // default: 50
  readonly queueHeadroom?: number; // beta, default: 3
  readonly maxQueueDelayMs?: number; // CoDel, default: 15ms
  readonly baselineDecayIntervalMs?: number; // default: 60,000ms
}

export interface AdmissionDecision {
  readonly admitted: boolean;
  readonly currentLimit: number;
  readonly inFlight: number;
  readonly priority: PriorityTier;
  readonly reason?: string;
  readonly sha256Receipt: string;
}

export interface ConcurrencyGovernorStatus {
  readonly currentLimit: number;
  readonly inFlight: number;
  readonly baselineRttMs: number;
  readonly currentRttMs: number;
  readonly gradient: number;
  readonly totalAdmitted: number;
  readonly totalShed: number;
  readonly shedByTier: Record<PriorityTier, number>;
  readonly sha256Receipt: string;
}
```

---

## 3. Atomic Implementation Steps

1. Create `docs/tasks/TASKS-112-ADAPTIVE-CONCURRENCY-GOVERNOR.md`.
2. Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
3. Author formal TLA+ model `AdaptiveConcurrencyGovernor.tla` and register in `scripts/verify-formal-tla.mjs`.
4. Implement `src/core/eosAdaptiveConcurrencyGovernor.ts` (pure Layer 0).
5. Export in `src/core/index.ts`.
6. Expose MCP tools `eos_concurrency_evaluate` and `eos_concurrency_status` in `src/mcp/eosMcpServer.ts` and `docs/contracts/mcp-tool-catalog.json`.
7. Author comprehensive test suite `test/eosAdaptiveConcurrencyGovernor.test.mjs`.
8. Execute 7-stage pre-commit gate `npm run verify:strict`.
9. Commit and push to `origin/main`.
10. Re-verify Fleet Soundcheck.
