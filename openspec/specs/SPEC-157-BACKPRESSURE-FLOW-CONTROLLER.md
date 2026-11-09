# SPEC-157: Backpressure Flow Controller with Demand Signaling and TCP-Style Congestion Window

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Pushing data faster than a consumer can process it produces unbounded buffering, memory blowup, and latency collapse. A resilient data plane must instead let the consumer declare how much it can handle and force the producer to respect that demand, adapting the allowance to observed conditions. This is the classic Reactive Streams contract, and it is the same idea that TCP uses to control its congestion window.

The `EosBackpressureFlowController` implements demand-based flow control: the consumer signals demand, the producer may only emit while demand and window permit, and the controller adapts its congestion window in a TCP-like manner. Acknowledge performs an additive increase; signaling loss performs a multiplicative decrease.

Producer and consumer are further coordinated through high/low watermarks that expose a pressure state (OPEN, HIGH_WATER, CLOSED), and every observation is available as a deeply frozen snapshot. The module is self-contained and uses no external dependencies, satisfying Law V.

## 2. Functional Requirements (EARS Syntax)

- **FR-661 (Ubiquitous - Demand-Gated Emission)**: `The EOS Backpressure Flow Controller shall accept an emit only when outstanding demand is greater than zero and the in-flight count is below the current congestion window, otherwise rejecting the emit and incrementing the cumulative rejected counter.`
- **FR-662 (Ubiquitous - Consumer Demand Signaling)**: `The system shall allow the consumer to register additional demand with a non-negative count, rejecting negative counts via a precondition guard, and shall decrement demand by one per accepted emit.`
- **FR-663 (Event-Driven - Additive Increase on Acknowledge)**: `When the consumer acknowledges a processed item, the system shall reduce the in-flight count by one and increase the congestion window by one, capped at the configured maximum window.`
- **FR-664 (Unwanted Condition - Multiplicative Decrease on Loss)**: `If loss is signaled, then the system shall reduce the congestion window to the floor of window times the congestion multiplier, floored at 1, and decrement the in-flight count when positive.`
- **FR-665 (State-Driven - Watermark Pressure State)**: `While the in-flight-to-window ratio is at or above the high watermark, the system shall report the HIGH_WATER pressure state, and while the ratio is at or below the low watermark it shall report OPEN.`
- **FR-666 (Ubiquitous - Frozen Flow Snapshot)**: `The system shall expose a deeply frozen snapshot reporting the window size, in-flight count, remaining demand, pressure state, and utilization percent.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-661 Emit requires a demand signal
GIVEN an EosBackpressureFlowController with an initial window of 10
WHEN an emit is attempted before any demand is signaled, then demand 3 is signaled and four emits are attempted
THEN the pre-demand emit is rejected
AND the first three post-demand emits are accepted
AND the fourth post-demand emit is rejected because demand is exhausted

SCENARIO: BDD-662 Loss reduces the window multiplicatively
GIVEN an EosBackpressureFlowController with an initial window of 20 and congestionMultiplier 0.5
WHEN an item is emitted and a loss is signaled
THEN the snapshot reports a window size of 10

SCENARIO: BDD-663 Acknowledge increases the window additively
GIVEN an EosBackpressureFlowController with an initial window of 5
WHEN an item is emitted and acknowledged
THEN the snapshot reports a window size of 6

SCENARIO: BDD-664 Positive emit raises the pressure state
GIVEN an EosBackpressureFlowController with highWatermark 80
WHEN demand is signaled and enough items are emitted to exceed the high watermark ratio
THEN the snapshot reports the HIGH_WATER pressure state
AND the utilization percent reflects the in-flight-to-window ratio
```

## 4. Architecture Decision Records (ADRs)

- **ADR-157-1: Demand-driven Reactive Streams contract**
  - _Context_: A producer allowed to emit freely overwhelms slow consumers, causing unbounded buffering and memory pressure.
  - _Decision_: Gate every emit on outstanding consumer demand and enforce it as a hard precondition rather than a best-effort hint.
  - _Consequence_: The producer physically cannot outrun the consumer; throughput becomes a negotiated quantity owned by the consumer.
- **ADR-157-2: TCP-like congestion window adaptation**
  - _Context_: A fixed emission window either starves throughput on healthy links or fails to retreat quickly on loss.
  - _Decision_: Apply additive increase on acknowledge and multiplicative decrease on loss, mirroring TCP congestion control.
  - _Consequence_: Throughput ramps steadily under stability and backs off fast under loss, coordinating with high/low watermarks for pressure signaling.

## 5. Atomic Task DAG

1. [x] **TASK-157-1**: Author SPEC-157 with EARS requirements FR-661..FR-666 and BDD scenarios BDD-661..BDD-664.
2. [x] **TASK-157-2**: Implement the `EosBackpressureFlowController` module (demand gating, congestion window, watermarks, snapshot).
3. [x] **TASK-157-3**: Add unit tests covering demand gating, multiplicative decrease and additive increase.
4. [x] **TASK-157-4**: Integrate the scenario into the Big Tech Resilience test suite and confirm zero external dependencies.
