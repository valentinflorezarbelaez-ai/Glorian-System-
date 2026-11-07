# SPEC-158: Unified Resilience Mesh Composing Circuit Breaker, Bulkhead, Timeout and Retry

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Individual resilience primitives applied in isolation still leave gaps: a retry without a timeout amplifies a slow upstream, a circuit breaker without a bulkhead lets a flood of calls overwhelm the breaker itself, and an unjittered backoff synchronizes retries into thundering herds. Durable services must compose several primitive strategies into a single, ordered call pipeline.

This module follows the production pattern of Envoy, Istio, and Failsafe: a composable resilience chain that routes every call through bulkhead → circuit breaker → timeout → retry. The `EosResilienceMesh` class implements that chain as one `execute(fn)` entry point.

Each call returns a structured result capturing success, value, error, attempts used, circuit state, elapsed time, and the rejection reason, so callers can react precisely to bulkhead or open-circuit rejections versus genuine failures. The module depends only on kernel primitives, honoring Law V.

## 2. Functional Requirements (EARS Syntax)

- **FR-671 (Ubiquitous - Bulkhead Concurrency Limit)**: `The EOS Resilience Mesh shall reject a call with a BULKHEAD rejection reason when the number of in-flight calls has reached maxConcurrent, without executing the supplied function.`
- **FR-672 (State-Driven - Circuit Breaker Fast-Fail)**: `While the circuit breaker is OPEN, the system shall reject the call with a CIRCUIT_OPEN rejection reason and shall not execute the supplied function.`
- **FR-673 (Event-Driven - Per-Call Timeout Enforcement)**: `When the supplied function does not settle within timeoutMs, the system shall treat the call as a failure and raise a TIMEOUT error for that attempt.`
- **FR-674 (Event-Driven - Exponential Backoff with Jitter)**: `When an attempt fails and retries remain, the system shall delay the next attempt by baseBackoffMs times two to the power of the attempt index minus one, plus a random jitter up to jitterMs.`
- **FR-675 (State-Driven - Circuit Breaker Transitions)**: `While consecutive failures reach failureThreshold, the system shall open the circuit and record the open time; while the cooldown has elapsed the circuit shall become HALF_OPEN; on any success the system shall reset the circuit to CLOSED and clear the failure count.`
- **FR-676 (Ubiquitous - Structured Call Result)**: `The system shall return a deeply frozen result reporting success, value, error, attemptsUsed, circuitState, elapsedMs, and the rejection reason (NONE, BULKHEAD, or CIRCUIT_OPEN).`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-671 A successful call passes through the mesh on the first attempt
GIVEN an EosResilienceMesh allowing 10 concurrent calls
WHEN the supplied function resolves successfully
THEN the result reports success true
AND the value equals the returned value
AND attemptsUsed is 1

SCENARIO: BDD-672 A timeout triggers a retry until success
GIVEN an EosResilienceMesh with a short timeout and maxRetries 3
WHEN the supplied function times out on its first two attempts and succeeds on the third
THEN the result reports success true
AND attemptsUsed is 3

SCENARIO: BDD-673 Repeated failures open the circuit breaker
GIVEN an EosResilienceMesh with failureThreshold 2 and zero retries
WHEN two calls fail consecutively and a third call is issued
THEN the circuit state is OPEN
AND the third call is rejected with reason CIRCUIT_OPEN

SCENARIO: BDD-674 The bulkhead rejects when at capacity
GIVEN an EosResilienceMesh with maxConcurrent 1
WHEN a slow call is in flight and a second call is issued
THEN the second call is rejected with reason BULKHEAD
AND the in-flight call still completes successfully
```

## 4. Architecture Decision Records (ADRs)

- **ADR-158-1: Ordered composition bulkhead → circuit → timeout → retry**
  - _Context_: Independent primitives leave ordering gaps; e.g. an open circuit should be detected before spending a bulkhead slot, and timeouts must wrap each retry attempt.
  - _Decision_: Evaluate the bulkhead and circuit breaker before execution, then run retries where each attempt is individually bounded by the timeout race.
  - _Consequence_: Rejections are cheap (no function invocation), each attempt respects the deadline, and retries are isolated from one another.
- **ADR-158-2: Jittered exponential backoff to avoid retry storms**
  - _Context_: Synchronized retries against a recovering upstream produce thundering-herd overload that re-breaks the dependency.
  - _Decision_: Combine exponential backoff with a random jitter capped at jitterMs on every retry delay.
  - _Consequence_: Retry traffic spreads over time, reducing correlated spikes while preserving fast recovery.

## 5. Atomic Task DAG

1. [x] **TASK-158-1**: Author SPEC-158 with EARS requirements FR-671..FR-676 and BDD scenarios BDD-671..BDD-674.
2. [x] **TASK-158-2**: Implement the `EosResilienceMesh` module (bulkhead, circuit breaker, timeout race, jittered retry, structured result).
3. [x] **TASK-158-3**: Add unit tests covering success pass-through, timeout retry, circuit opening and bulkhead rejection.
4. [x] **TASK-158-4**: Integrate the scenario into the Big Tech Resilience test suite and confirm zero external dependencies.
