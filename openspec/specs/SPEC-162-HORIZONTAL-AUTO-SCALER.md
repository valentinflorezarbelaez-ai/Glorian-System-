# SPEC-162: Horizontal Auto-Scaler with Stabilization Windows and Rate-of-Change Limiting

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Reactive horizontal scaling prevents a fleet from being either over-provisioned or saturated, but naive controllers oscillate: a single noisy metric can trigger scale-up, whose added capacity immediately triggers scale-down, producing destructive flapping. Production autoscalers therefore combine three safeguards, as Kubernetes HPA and AWS Auto Scaling both do: a metrics-driven desired count, stabilization windows (cooldowns) that suppress opposite-direction changes for a bounded number of intervals, and a rate-of-change limit that bounds how many replicas may be added or removed per tick.

This module implements that doctrine as a deterministic simulator. `EosHorizontalAutoScaler` consumes one aggregate-load observation per tick, derives a clamped desired replica count, rate-limits the change, and applies the appropriate cooldown before committing a SCALE_UP, SCALE_DOWN, HOLD or COOLDOWN action. Every decision is recorded in an immutable trace, and a SHA-256 fingerprint over the trace provides a reproducible artifact for CI regression detection.

The simulator is intentionally clock-free: progression is driven by an internal tick counter rather than wall-clock time, which makes cooldown behavior exactly reproducible in tests. It lives in Layer 0 with zero external dependencies.

## 2. Functional Requirements (EARS Syntax)

- **FR-711 (Ubiquitous - Metrics-Driven Desired Replicas)**: `The EOS System shall compute a raw desired replica count as ceil(aggregateLoad divided by targetUtilization) and clamp it into the inclusive range [minReplicas, maxReplicas] on every observation.`
- **FR-712 (Event-Driven - Rate-of-Change Limiting)**: `When the absolute difference between the clamped desired count and the current replica count exceeds maxDeltaPerTick, the EOS System shall cap the per-tick change to exactly maxDeltaPerTick in the direction of the required change.`
- **FR-713 (State-Driven - Scale-Up Stabilization Window)**: `While fewer than scaleUpCooldownTicks ticks have elapsed since the last scale-up, the EOS System shall suppress further upward adjustments, returning action COOLDOWN and holding the current replica count.`
- **FR-714 (State-Driven - Scale-Down Stabilization Window)**: `While fewer than scaleDownCooldownTicks ticks have elapsed since the last scale-down, the EOS System shall suppress further downward adjustments, returning action COOLDOWN and holding the current replica count.`
- **FR-715 (Ubiquitous - Decision Trace and Deterministic Fingerprint)**: `The EOS System shall record an immutable ScaleDecision for every observation carrying tick, observedMetric, currentReplicas, desiredReplicas, action and reason, and shall expose traceFingerprint as the SHA-256 digest over the ordered sequence of "tick:action:currentReplicas" tokens, which is identical for identical input sequences.`
- **FR-716 (Ubiquitous - Configuration Invariants and Steady State)**: `The EOS System shall enforce at construction that minReplicas is at least 1, that maxReplicas is at least minReplicas and that targetUtilization is positive, shall initialize currentReplicas to the supplied initial value or minReplicas, and shall return action HOLD with reason "steady state" when the desired count equals the current count.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-711 High Load Triggers Rate-Limited SCALE_UP
  GIVEN an EosHorizontalAutoScaler with minReplicas 2, maxReplicas 20, targetUtilization 10 and maxDeltaPerTick 5
  WHEN observe(100) is called from an initial two replicas
  THEN the raw target of 10 is capped to current plus five
  AND the action is "SCALE_UP"
  AND the resulting currentReplicas is 7
```

```gherkin
SCENARIO: BDD-712 Maximum Replicas Cap Applies
  GIVEN the same scaler configured with maxDeltaPerTick 20
  WHEN observe(500) is called
  THEN the desired count is clamped to maxReplicas
  AND the resulting currentReplicas is 20
```

```gherkin
SCENARIO: BDD-713 Low Load After Cooldown Triggers SCALE_DOWN
  GIVEN a scaler with scaleDownCooldownTicks 1
  WHEN it scales up on observe(100), holds on observe(100), then observes a load of 20
  THEN the final decision action is "SCALE_DOWN"
```

```gherkin
SCENARIO: BDD-714 Trace Fingerprint Is Deterministic
  GIVEN two independent scalers constructed with identical configuration
  WHEN both observe the same load sequence [50, 100, 30]
  THEN traceFingerprint is identical for both scalers
  AND the replica count never falls below minReplicas
```

## 4. Architecture Decision Records (ADRs)

- **ADR-162-1: Cooldown Stabilization Windows to Prevent Scaling Flapping**
  - _Context_: Rapid opposing scale actions cause replica thrashing and destabilize the fleet.
  - _Decision_: Track the tick of the last scale-up and last scale-down and suppress same-direction changes until the configured cooldown has elapsed, emitting action COOLDOWN.
  - _Consequence_: The scaler reacts more slowly to genuinely changing load, trading reactivity for stability, and cooldown windows must be tuned per workload.
- **ADR-162-2: Clock-Free Deterministic Simulator**
  - _Context_: Cooldown logic based on wall-clock time is hard to test reproducibly, and zero external dependencies are required (Law V).
  - _Decision_: Drive progression with an internal tick counter and rate-limit replica changes by maxDeltaPerTick, exposing a SHA-256 trace fingerprint.
  - _Consequence_: Behavior is fully reproducible for CI, but the simulator does not model real metrics pipelines or pod-startup latency.

## 5. Atomic Task DAG

1. [x] **TASK-162-1**: Author SPEC-162 (this document) defining desired-replica computation, cooldown windows and rate limiting.
2. [x] **TASK-162-2**: Implement `EosHorizontalAutoScaler` in `src/core/eosHorizontalAutoScaler.ts` with observe, replicas, history and traceFingerprint.
3. [x] **TASK-162-3**: Enforce configuration invariants and record an immutable per-tick decision trace.
4. [x] **TASK-162-4**: Verify the behavior with the SPEC-162 scenarios in `test/eosBigTechDistributed.test.mjs`.
