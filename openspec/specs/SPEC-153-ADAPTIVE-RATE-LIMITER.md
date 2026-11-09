# SPEC-153: Adaptive Rate Limiter with Dual-Strategy Bucket and Sliding Window Control

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

The EOS control plane must protect downstream services from request bursts without requiring manual operator tuning of thresholds. Uncontrolled traffic surges cause cascading saturation, while static limits either throttle healthy load or fail to shield a degraded backend. This module provides the Layer 0 admission gate that decides, per request, whether to allow or reject the call while emitting a precise backpressure signal.

The architecture mirrors the production pattern of Cloudflare and AWS API Gateway: combine a token bucket for smooth burst allowance with a sliding window log for precise per-client counting, so that short bursts pass while sustained overruns are cut. The `EosAdaptiveRateLimiter` class implements both strategies behind a single `tryAcquire()` decision point.

The adaptive component is the differentiator: the limiter monitors its own rejection ratio and auto-tunes the bucket capacity using AIMD (Additive Increase, Multiplicative Decrease), converging on the true downstream capacity without human intervention. Every decision is deeply frozen and injection-safe, and the module declares zero external dependencies in accordance with Law V.

## 2. Functional Requirements (EARS Syntax)

- **FR-621 (Ubiquitous - Token Bucket Burst Admission)**: `The EOS Adaptive Rate Limiter shall admit up to the configured bucket capacity of requests as a burst, consuming one token per accepted acquisition and returning a frozen decision that carries the remaining token count.`
- **FR-622 (Event-Driven - Time-Based Refill)**: `When a request arrives and time has elapsed since the last refill, the system shall replenish tokens by (elapsed seconds × refillRatePerSec), capped at the current adaptive capacity, before evaluating the request.`
- **FR-623 (State-Driven - Sliding Window Throughput Cap)**: `While the number of logged timestamps within the configured windowSizeMs has reached maxPerWindow, the system shall deny the request regardless of available tokens.`
- **FR-624 (Event-Driven - AIMD Additive Increase)**: `When the limiter is adaptive and its rejection ratio is below 0.01, the system shall increase the current capacity additively by one unit, bounded above by four times the configured bucket capacity.`
- **FR-625 (Unwanted Condition - AIMD Multiplicative Decrease and Retry Hint)**: `If the limiter is adaptive and a request is denied, then the system shall multiplicatively decrease the current capacity to 75% (floored at 1) and return a retryAfterMs derived from the refill rate and the token deficit.`
- **FR-626 (Ubiquitous - Immutable Decisions and Cumulative Stats)**: `The system shall return deeply frozen decision objects and expose cumulative counters (totalRequests, totalRejections, currentCapacity, tokens) through getStats().`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-621 Allows burst up to bucket capacity
GIVEN an EosAdaptiveRateLimiter with bucketCapacity 10, refillRatePerSec 100 and adaptive disabled
WHEN 10 sequential tryAcquire calls are issued
THEN all 10 acquisitions are allowed
AND each allowed decision reports a non-negative remaining token count

SCENARIO: BDD-622 Denies after bucket exhaustion
GIVEN an EosAdaptiveRateLimiter with bucketCapacity 5 and refillRatePerSec 0
WHEN 5 acquisitions consume the bucket and a 6th tryAcquire is issued
THEN the 6th decision is denied
AND the remaining token count is 0

SCENARIO: BDD-623 Sliding window caps throughput
GIVEN an EosAdaptiveRateLimiter with a large bucket but maxPerWindow of 3
WHEN 3 acquisitions fill the sliding window and a 4th tryAcquire is issued
THEN the 4th decision is denied by the window limit

SCENARIO: BDD-624 Adaptive decreases capacity on rejections
GIVEN an EosAdaptiveRateLimiter with adaptive enabled and refillRatePerSec 0
WHEN 20 acquisitions exhaust the bucket and produce rejections
THEN getStats returns a currentCapacity that is less than or equal to the initial bucket capacity
```

## 4. Architecture Decision Records (ADRs)

- **ADR-153-1: Dual-strategy (token bucket + sliding window) admission**
  - _Context_: A single limiter strategy cannot simultaneously smooth bursts and enforce a hard per-window ceiling without either throttling legitimate spikes or leaking sustained overruns.
  - _Decision_: Evaluate both the token bucket and the sliding window log on every acquisition, denying when either limit is exceeded.
  - _Consequence_: Bursty workloads pass while sustained overload is capped; the sliding window log is periodically evicted to bound memory.
- **ADR-153-2: AIMD self-tuning instead of static capacity**
  - _Context_: Operators cannot predict downstream capacity, and static thresholds drift out of tune as backends scale.
  - _Decision_: Let the limiter grow capacity additively while healthy and shrink it multiplicatively on rejection, keyed off the live rejection ratio.
  - _Consequence_: Capacity self-converges near the true backend limit; a misconfigured adaptive flag simply reverts to static behavior.

## 5. Atomic Task DAG

1. [x] **TASK-153-1**: Author SPEC-153 with EARS requirements FR-621..FR-626 and BDD scenarios BDD-621..BDD-624.
2. [x] **TASK-153-2**: Implement the `EosAdaptiveRateLimiter` module (token bucket, sliding window log, AIMD tuner, frozen decisions).
3. [x] **TASK-153-3**: Add unit tests covering burst admission, exhaustion denial, window capping and adaptive capacity decay.
4. [x] **TASK-153-4**: Verify zero external dependencies and integration in the Big Tech Resilience test suite.
