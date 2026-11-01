# PLAN-114: Predictive Failure Correlator & Closed-Loop Auto-Remediation Engine

## 1. Architecture Decision Record (ADR-114)

### Context
When distributed microservices degrade under high load, disparate subsystems emit isolated metrics: the SLO governor alerts on burn rate, the concurrency limiter contracts limits, the hedged mesh throttles speculative requests, and the trace sampler captures error spikes. Without a centralized correlation brain, these subsystems react independently without understanding the root failure archetype, and human engineers must manually diagnose the cascade.

In Google SRE and Meta production engineering, an automated closed-loop remediation engine (*Aegis / Sherlock*) ingests cross-domain telemetry vectors, matches incident signatures against canonical failure archetypes, and executes bounded, safe, and reversible mitigation playbooks within milliseconds.

### Decision
Implement `EosPredictiveRemediationEngine` in pure TypeScript Layer 0:
1. **Multi-Signal Telemetry Vector**: Aggregate SLO burn rates, Vegas concurrency gradients, trace tail latencies, hedge ratios, and queue delays into a composite health vector.
2. **Deterministic Archetype Classification Engine**:
   - `ARCHETYPE_CASCADE_TIMEOUT`: High tail latency ($P99 > 800\text{ms}$) + Gradient $< 0.40$ + Elevated burn rate.
   - `ARCHETYPE_RETRY_STORM`: Hedge/duplicate ratio $> 5\%$ + Trace error rate $> 10\%$.
   - `ARCHETYPE_CONCURRENCY_COLLAPSE`: Inflight ratio $\ge 0.95$ + Queue wait $> 15\text{ms}$.
   - `ARCHETYPE_RELEASE_REGRESSION`: Sharp error jump following deployment ($BurnRate_{5m} > 14.4$ while gradient remains healthy).
   - `ARCHETYPE_NOMINAL`: Normal metrics ($HealthScore \ge 90$).
3. **Closed-Loop Mitigation Actions**:
   - `ACTION_CONCURRENCY_THROTTLE`
   - `ACTION_SUPPRESS_SPECULATIVE_HEDGING`
   - `ACTION_SHED_BEST_EFFORT`
   - `ACTION_CANARY_ROLLBACK`
   - `ACTION_REVERT_TO_NOMINAL`
4. **Anti-Flapping Hysteresis & Cooldown**:
   - Require a minimum cooldown period (`cooldownMs`, default: 30,000ms) between automated actions to prevent oscillatory flapping.
   - Suppress redundant executions with status `SUPPRESSED_COOLDOWN_ACTIVE`.
5. **Cryptographic Verification**:
   - Every correlation and remediation event generates a tamper-evident SHA-256 audit receipt.

### Rejected Alternatives
* **Alternative A: Relying Exclusively on Human Alerting & Manual Runbooks**
  * *Why Rejected*: High Mean Time to Recovery (MTTR). Cascades unfold in seconds, while human on-call acknowledgment takes 5-15 minutes.
* **Alternative B: Unconstrained Automated Execution Without Cooldown**
  * *Why Rejected*: Risk of positive feedback loops and oscillatory instability (*flapping* between throttle and expansion).
* **Alternative C: Third-Party AIOps External Runtime Dependencies**
  * *Why Rejected*: Violates EOS Law V (Clean/Hexagonal Purity) and Law IV (Layer 0 Purity) by introducing external runtime npm dependencies.

---

## 2. Data Contracts & Interfaces

```typescript
export interface TelemetryHealthVector {
  readonly burnRate5m: number;
  readonly burnRate1h: number;
  readonly concurrencyGradient: number;
  readonly concurrencyInFlightRatio: number;
  readonly traceErrorRate: number;
  readonly traceP99LatencyMs: number;
  readonly hedgeRequestRatio: number;
  readonly queueDelayMs: number;
}

export type FailureArchetype =
  | "ARCHETYPE_NOMINAL"
  | "ARCHETYPE_CASCADE_TIMEOUT"
  | "ARCHETYPE_RETRY_STORM"
  | "ARCHETYPE_CONCURRENCY_COLLAPSE"
  | "ARCHETYPE_RELEASE_REGRESSION";

export type RemediationActionType =
  | "ACTION_NONE"
  | "ACTION_CONCURRENCY_THROTTLE"
  | "ACTION_SUPPRESS_SPECULATIVE_HEDGING"
  | "ACTION_SHED_BEST_EFFORT"
  | "ACTION_CANARY_ROLLBACK"
  | "ACTION_REVERT_TO_NOMINAL";

export interface RemediationExecutionResult {
  readonly archetype: FailureArchetype;
  readonly action: RemediationActionType;
  readonly executed: boolean;
  readonly suppressedReason?: string;
  readonly healthScore: number;
  readonly timestampMs: number;
  readonly sha256Receipt: string;
}

export interface RemediationEngineConfig {
  readonly cooldownMs?: number;               // default: 30,000ms
  readonly minHealthScoreThreshold?: number;  // default: 70
  readonly maxRecoveryWindowMs?: number;      // default: 60,000ms
}

export interface RemediationEngineStatus {
  readonly activeArchetype: FailureArchetype;
  readonly activeAction: RemediationActionType;
  readonly currentHealthScore: number;
  readonly totalEvaluations: number;
  readonly totalRemediationsExecuted: number;
  readonly totalSuppressedCooldown: number;
  readonly lastMitigationTimestampMs: number;
  readonly sha256Receipt: string;
}
```

---

## 3. Integration Points
* **Layer 0 Core**: `src/core/eosPredictiveRemediationEngine.ts`, exported in `src/core/index.ts`.
* **MCP Server**: Registered in `src/mcp/eosMcpServer.ts` and `docs/contracts/mcp-tool-catalog.json`.
  - Tool 1: `eos_remediation_correlate_execute` (evaluates telemetry vector and executes closed-loop playbook).
  - Tool 2: `eos_remediation_engine_status` (queries current archetype, mitigation state, and cooldown telemetry).
* **Formal Verification**: `docs/formal/PredictiveRemediationEngine.tla` and `scripts/verify-formal-tla.mjs` (Model 34).
