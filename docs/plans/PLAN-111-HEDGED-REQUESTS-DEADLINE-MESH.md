# PLAN-111: Distributed Adaptive Hedged Requests & Deadline Propagation Mesh

## 1. Architecture Decision Record (ADR-111)

### Context
In distributed microservices, tail latency stragglers (due to GC pauses, thread pool queueing, hardware thermal throttling, or packet loss) disproportionately degrade end-to-end response times. Traditional retries only occur *after* a full timeout, multiplying total latency. Google's *"The Tail at Scale"* paper demonstrates that speculative hedged requests issued after the 95th percentile ($P95$) dramatically compress $P99$ latency with negligible resource cost if bounded by an anti-storm budget.

### Decision
Implement `EosAdaptiveHedgedDeadlineMesh` in pure TypeScript Layer 0:
1. **P95 Reservoir Sampling**: Maintain a fixed-size ring buffer (e.g. 200 samples) per endpoint. Compute percentiles deterministically via sorting a slice or min-heap.
2. **Cooperative Cancellation**: Use native `AbortController` / `AbortSignal` for winner-takes-all cancellation of lagging requests.
3. **Monotonic Deadline Context**: Propagate an immutable `DeadlineContext` carrying `deadlineEpochMs` and calculate remaining budget before any I/O dispatch.
4. **Token-Bucket Hedging Guard**: Maintain a running ratio of hedged requests to total requests, enforcing a hard 5% threshold.

### Rejected Alternatives
* **Alternative A: Aggressive Parallel Fanout (Always Dual-Dispatch)**
  * *Why Rejected*: Doubling traffic across the fleet halves system capacity and leads to instant saturation during peak load. Adaptive hedging only dispatches a secondary request when the primary exceeds $P95$ (affecting at most 5% of requests).
* **Alternative B: Timeout-and-Retry**
  * *Why Rejected*: Waiting for a full timeout (e.g. 500ms or 1000ms) before re-trying creates unbearable tail latency and doubles the worst-case time.
* **Alternative C: Third-Party RPC Frameworks (e.g., gRPC, Finagle)**
  * *Why Rejected*: Violates Law V (Architectural Purity) and Law IV (Layer 0 Purity) by introducing external npm runtime dependencies.

---

## 2. Data Contracts & Interfaces

```typescript
export interface DeadlineContext {
  readonly traceId: string;
  readonly deadlineEpochMs: number;
  getRemainingMs(now?: number): number;
  isExpired(now?: number): boolean;
}

export interface HedgedExecutionOptions<T> {
  readonly endpointId: string;
  readonly deadlineMs?: number;
  readonly maxHedges?: number; // default: 1
  readonly primaryFn: (signal: AbortSignal) => Promise<T>;
  readonly hedgedFn: (signal: AbortSignal) => Promise<T>;
}

export interface HedgedExecutionResult<T> {
  readonly result: T;
  readonly executedBy: "PRIMARY" | "HEDGED";
  readonly latencyMs: number;
  readonly hedgeDispatched: boolean;
  readonly sha256Receipt: string;
}

export interface MeshMetricsSnapshot {
  readonly totalRequests: number;
  readonly hedgedRequests: number;
  readonly hedgedRatePct: number;
  readonly shedRequests: number;
  readonly endpoints: Record<string, {
    readonly sampleCount: number;
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
  }>;
  readonly sha256Receipt: string;
}
```

---

## 3. Atomic Implementation Steps
1. Create `docs/tasks/TASKS-111-HEDGED-REQUESTS-DEADLINE-MESH.md`.
2. Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
3. Author formal TLA+ model `AdaptiveHedgedDeadlineMesh.tla` and register in `scripts/verify-formal-tla.mjs`.
4. Implement `src/core/eosAdaptiveHedgedDeadlineMesh.ts` (pure Layer 0).
5. Export in `src/core/index.ts`.
6. Expose MCP tools `eos_hedge_request_execute` and `eos_hedge_metrics_status` in `src/mcp/eosMcpServer.ts` and `docs/contracts/mcp-tool-catalog.json`.
7. Author comprehensive test suite `test/eosAdaptiveHedgedDeadlineMesh.test.mjs`.
8. Execute 7-stage pre-commit gate `npm run verify:strict`.
9. Commit and push to `origin/main`.
10. Re-verify Fleet Soundcheck.
