# PLAN-110: Multi-Window Multi-Burn-Rate SLO & Error Budget Governor

## Metadata
* **Plan ID**: `PLAN-110`
* **Architecture Decision Record**: `ADR-110`
* **Governing Specification**: `SPEC-110`
* **Author / Architect**: `Valentín Flórez Arbeláez`
* **Date**: `2026-10-31`
* **Status**: `APPROVED`
* **Target Layer**: `Layer 0 (Core Infrastructure)`

---

## 1. Architectural Strategy

To achieve Google SRE-grade operational excellence across all fleet repositories, EOS introduces `EosMultiWindowSloGovernor`:

```text
               High-Frequency Telemetry Ingestion (Status, Latency, Timestamp)
                                       │
                                       ▼
             ┌──────────────────────────────────────────────────┐
             │         Sliding-Window Ring Accumulator          │
             │   [Short: 5m, 30m]      [Long: 1h, 6h, 30d]      │
             └──────────────────────────────────────────────────┘
                                       │
                                       ▼
             ┌──────────────────────────────────────────────────┐
             │       Burn Rate Calculator: B = ErrorRate / EB   │
             └──────────────────────────────────────────────────┘
                      │                                  │
          Dual-Window Correlation             Error Budget Accounting
      (B_1h >= 14.4 AND B_5m >= 14.4)        (EB_remaining = 1 - Consumed)
                      │                                  │
                      ▼                                  ▼
             ┌──────────────────────────────────────────────────┐
             │       Autonomous Fleet Deployment Gatekeeper     │
             └──────────────────────────────────────────────────┘
                      /                                  \
          EB > 0 AND No Alert                   EB <= 0 OR Tier 1 Alert
                    /                                      \
                   ▼                                        ▼
          [PROMOTION ALLOWED]                      [DEPLOYMENT FROZEN]
          (Normal CI/CD & Canary)                  (Fail-Closed Auto-Block)
```

---

## 2. ADR-110: Architectural Decision Record

### Context & Problem Statement
Simple static threshold alerts cause engineer alert fatigue on transient spikes and allow slow outages to exhaust error budgets before anyone notices. Furthermore, deployments during active degradation exacerbate outages.

### Considered Alternatives
1. **Static Threshold Alerting (e.g. 5xx > 1%)**:
   * *Rejected*: Cannot distinguish between a brief 10-second blip and a sustained bleed. Causes high on-call noise.
2. **Single 30-Day Long Window Alerting**:
   * *Rejected*: Far too slow to catch catastrophic outages that burn through the entire month's budget in 2 hours.
3. **Google SRE Multi-Window Multi-Burn-Rate Model with Deployment Freeze Gate (SELECTED)**:
   * *Rationale*: Correlates short (5m) and long (1h) windows to ensure alerts fire only during active, sustained incidents. Directly couples error budget depletion to the autonomous deployment gate to freeze releases during outages.

---

## 3. Data Contracts & Interfaces

```typescript
export interface SloTargetConfig {
  readonly serviceId: string;
  readonly availabilitySlo: number;       // e.g. 0.999 (99.9%)
  readonly latencyThresholdMs?: number;   // e.g. 400ms
  readonly latencySlo?: number;           // e.g. 0.99 (99%)
}

export type SloHealthState = "NOMINAL_HEALTHY" | "ELEVATED_BURN" | "CRITICAL_BURN" | "BUDGET_EXHAUSTED";

export interface BurnRateSnapshot {
  readonly windowLabel: string;
  readonly totalEvents: number;
  readonly totalErrors: number;
  readonly errorRate: number;
  readonly burnRate: number;
}

export interface ServiceSloStatus {
  readonly serviceId: string;
  readonly availabilitySlo: number;
  readonly errorBudgetFraction: number;    // 1.0 - availabilitySlo
  readonly errorBudgetRemainingPct: number;// Remaining % of error budget
  readonly isDeploymentFrozen: boolean;
  readonly healthState: SloHealthState;
  readonly windows: {
    readonly window5m: BurnRateSnapshot;
    readonly window1h: BurnRateSnapshot;
    readonly window30m: BurnRateSnapshot;
    readonly window6h: BurnRateSnapshot;
  };
  readonly activeAlerts: string[];
  readonly sha256Receipt: string;
}
```

---

## 4. Operational Invariants
* **Non-Negative Headroom Precision**: Floating-point budget accounting operates in IEEE 754 Float64 precision.
* **Fail-Closed Deployment Block**: Any service in `DEPLOYMENT_FROZEN` state rejects canary promotions deterministically.
* **Dual-Window Alert Suppression**: No Tier 1 alert can fire unless both short and long windows exceed $14.4\times$.
