# PLAN-115: Unified Autonomous Operating System Kernel & Omni-Control Orchestrator

## 1. Architecture Overview

The `EosUnifiedKernelOrchestrator` integrates multiple Tier-0 resilience and telemetry sub-systems into an autonomous Sense $\to$ Analyze $\to$ Predict $\to$ Mitigate $\to$ Reconcile $\to$ Attest loop.

```mermaid
graph TD
    subgraph "Sub-System Inputs"
        FS["Fleet Soundcheck Mesh (SPEC-050)"]
        SLO["Multi-Window SLO Governor (SPEC-110)"]
        PRED["Predictive Remediation Engine (SPEC-114)"]
        CONC["Adaptive Concurrency Governor (SPEC-112)"]
        CAN["Canary Observability Gate (SPEC-107)"]
        eBPF["Synthetic eBPF Virtual Kernel Probe"]
    end

    subgraph "EosUnifiedKernelOrchestrator"
        SYNTH["OSEI Synthesizer (Weighted Composite Calculation)"]
        DECIDER["Proportional Mitigation Decision Engine"]
        RECON["State Reconciler & Invariant Enforcer"]
        ATTEST["SHA-256 Attestation Generator"]
    end

    subgraph "Mitigation Actions"
        NOM["STABILIZE_NOMINAL"]
        THROT["THROTTLE_ADAPTIVE"]
        FRZ["FREEZE_CANARIES"]
        DRAIN["DRAIN_SATURATED_SHARDS"]
        SHED["EMERGENCY_SHED"]
    end

    FS --> SYNTH
    SLO --> SYNTH
    PRED --> SYNTH
    CONC --> SYNTH
    eBPF --> SYNTH

    SYNTH --> DECIDER
    DECIDER --> RECON
    RECON --> ATTEST

    DECIDER --> NOM
    DECIDER --> THROT
    DECIDER --> FRZ
    DECIDER --> DRAIN
    DECIDER --> SHED
```

## 2. ADR-115: Unified Control Loop Design

- **Decision**: Implement a centralized Layer 0 state synthesizer and reconciler in pure TypeScript/Node.js standard library with zero external runtime npm dependencies (`dependencies: {}`).
- **Rejected Alternative 1: Microservices Multi-Process RPC Gossip**:
  - _Reason for Rejection_: Excessive IPC latency, failure modes from network partition during critical cascading outages, and violation of the Layer 0 zero-dependency hermetic principle.
- **Rejected Alternative 2: Polling Background Daemon without Deterministic Control Cycle**:
  - _Reason for Rejection_: Unbounded execution cycles and race conditions with in-flight test runners and CI/CD pipelines.

## 3. Data Contracts

```typescript
export interface KernelSystemTelemetry {
  fleetSoundcheckScore: number; // 0-100
  sloErrorBudgetConsumptionPct: number; // 0-100
  predictiveHazardSeverityPct: number; // 0-100
  concurrencyHeadroomPct: number; // 0-100
  syntheticSocketBacklog?: number; // 0-1000
  virtualPagePressurePct?: number; // 0-100
}

export type KernelMitigationAction =
  | "STABILIZE_NOMINAL"
  | "THROTTLE_ADAPTIVE"
  | "FREEZE_CANARIES"
  | "DRAIN_SATURATED_SHARDS"
  | "EMERGENCY_SHED";

export interface KernelReconciliationReceipt {
  cycleId: string;
  timestamp: number;
  oseiScore: number;
  state: "BALANCED" | "DEGRADED" | "CRITICAL";
  mitigationAction: KernelMitigationAction;
  canaryFreezeActive: boolean;
  sha256Attestation: string;
}
```
