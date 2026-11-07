# PLAN-109: Distributed Cell-Based Bulkhead Governor & Fault Domain Isolation Engine

## Metadata

- **Plan ID**: `PLAN-109`
- **Architecture Decision Record**: `ADR-109`
- **Governing Specification**: `SPEC-109`
- **Author / Architect**: `Valentín Flórez Arbeláez`
- **Date**: `2026-10-31`
- **Status**: `APPROVED`
- **Target Layer**: `Layer 0 (Core Infrastructure)`

---

## 1. Architectural Strategy

To eliminate systemic cascading failures and achieve Big Tech grade resilience (AWS, Meta, Netflix), the EOS control plane introduces `EosCellBasedBulkheadGovernor`:

```text
                  Incoming Request (tenantId, repoId, payload)
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       Poison Pill Quarantine Filter (SHA-256)    │
             └──────────────────────────────────────────────────┘
                      │                                  │
         Matches Quarantined Signature          Safe / Unquarantined
                      │                                  │
                      ▼                                  ▼
             [REJECT: 422 Unprocessable]     FNV-1a 32-bit Hash mod N
                                                         │
                                                         ▼
                                      ┌─────────────────────────────────────┐
                                      │       Target Cell Health Check      │
                                      └─────────────────────────────────────┘
                                       /                                   \
                             HEALTHY / CAPABLE                     DEGRADED / FULL
                                    /                                       \
                                   ▼                                         ▼
                        ┌────────────────────┐                    ┌────────────────────┐
                        │ Execute in Cell Ci │                    │ Adjacent Warm Cell │
                        │  (In-flight ++ )   │                    │ (Headroom Check)   │
                        └────────────────────┘                    └────────────────────┘
                                                                   /                  \
                                                             HAS HEADROOM          SATURATED
                                                                  /                    \
                                                                 ▼                      ▼
                                                       [Execute in C_next]     [SHED LOAD: 429]
```

---

## 2. ADR-109: Architectural Decision Record

### Context & Problem Statement

When dozens of agent workflows, compiler passes, and verification tests execute concurrently across registered fleet repositories, a single pathological AST mutation or runaway recursion could exhaust CPU, memory, or thread pools for all other workloads.

### Considered Alternatives

1. **Flat Monolithic Worker Pool with Single Global Queue**:
   - _Rejected_: Any slow or crashing job blocks the entire queue. Blast radius is 100%. Noisy neighbors starve critical control plane tasks.
2. **Active-Passive Master-Slave Dedicated Clusters**:
   - _Rejected_: Doubles hardware cost and introduces split-brain risk, complex election timeouts, and high cold-start latencies.
3. **Pure Layer 0 Cell-Based Bulkhead Governor with Immune Quarantine (SELECTED)**:
   - _Rationale_: Divides the fleet into $N$ autonomous failure domains in-process or distributed. Guarantees blast radius $\le 1/N$, detects poison pills automatically via SHA-256 signatures, and routes around degraded cells safely with zero external npm dependencies.

---

## 3. Data Contracts & Interfaces

```typescript
export type CellHealthStatus = "HEALTHY" | "DEGRADED" | "DRAINING" | "QUARANTINED";

export interface CellMetrics {
  readonly cellId: number;
  readonly name: string;
  readonly capacity: number;
  readonly inFlight: number;
  readonly totalAdmitted: number;
  readonly totalRejected: number;
  readonly totalFailures: number;
  readonly consecutiveFailures: number;
  readonly status: CellHealthStatus;
}

export interface RouteDecision {
  readonly cellId: number;
  readonly admitted: boolean;
  readonly isRerouted: boolean;
  readonly originalCellId?: number;
  readonly reason?: string;
  readonly quarantineSignature?: string;
  readonly executionToken?: string;
}

export interface GovernorConfig {
  readonly cellCount?: number; // Default: 8 cells
  readonly cellCapacity?: number; // Default: 100 concurrent requests per cell
  readonly maxConsecutiveFails?: number; // Default: 3 before quarantine
  readonly drainHeadroomRatio?: number; // Default: 0.8 (target cell must be <= 80% full)
}
```

---

## 4. Operational Invariants

- **In-Flight Boundedness**: In-flight requests per cell never exceed `cellCapacity`.
- **Zero Cross-Cell Pollution**: A failure or crash in Cell $A$ never mutates or corrupts Cell $B$.
- **Idempotent Poison Pill Filtering**: Quarantined signatures are checked in $O(1)$ time prior to dispatch.
