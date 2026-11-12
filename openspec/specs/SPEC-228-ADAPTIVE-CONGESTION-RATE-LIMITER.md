# SPEC-228 — Layer-0 Adaptive AIMD Congestion Control Rate Limiter with P99 Latency Feedback Loop

## Metadata

- **SPEC ID**: SPEC-228
- **Change ID**: CHANGE-113
- **Intake ID**: INTAKE-113
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosAdaptiveCongestionRateLimiterCore`

---

## 1. Overview

`EosAdaptiveCongestionRateLimiterCore` is a pure Layer-0 TypeScript module implementing:

1. **Token Bucket** — Fixed capacity `C` refilled at rate `r` tokens/second.
2. **AIMD Congestion Window** (`cwnd`) — TCP-inspired:
   - **Additive Increase**: `cwnd += ALPHA` per epoch when measured P99 < `LATENCY_THRESHOLD_MS`.
   - **Multiplicative Decrease**: `cwnd = max(MIN_CWND, cwnd * BETA)` when P99 ≥ threshold.
3. **Sliding HDR Histogram** — 1024-bucket exponential scale, O(1) amortised insert + P99.
4. **Admission Decision** — `ADMIT | THROTTLE | REJECT` based on token availability × cwnd.

---

## 2. Functional Requirements (EARS Syntax)

**FR-228-001** (Event-Driven)
WHEN a request arrives, THE SYSTEM SHALL check whether the token bucket has ≥1 available token AND
the number of in-flight requests is < `cwnd`; if both conditions hold it SHALL return `ADMIT`,
consume one token, and increment the in-flight counter.

**FR-228-002** (Event-Driven)
WHEN a request arrives and the token bucket is non-empty but `inFlight ≥ cwnd`, THE SYSTEM SHALL
return `THROTTLE` without consuming a token.

**FR-228-003** (Event-Driven)
WHEN a request arrives and the token bucket is empty, THE SYSTEM SHALL return `REJECT`.

**FR-228-004** (Event-Driven)
WHEN a request completes and the caller reports its observed latency in milliseconds, THE SYSTEM
SHALL record it in the sliding HDR histogram AND decrement `inFlight` AND apply AIMD: if the
current P99 estimate ≥ `LATENCY_THRESHOLD_MS` THEN `cwnd = max(MIN_CWND, floor(cwnd * BETA))`
ELSE `cwnd = min(MAX_CWND, cwnd + ALPHA)`.

**FR-228-005** (Ubiquitous)
THE SYSTEM SHALL provide a `stats()` method that returns the current token count, `cwnd`, in-flight
count, and P99 latency estimate (in ms) with no side-effects.

---

## 3. Non-Functional Requirements

- **NFR-228-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-228-B** `admit()` and `complete()` must each execute in O(1) amortised time.
- **NFR-228-C** The HDR histogram sliding window must expire buckets older than `WINDOW_MS` (default 10 000 ms).
- **NFR-228-D** AIMD parameters must be configurable at construction time (`alpha`, `beta`, `minCwnd`, `maxCwnd`, `latencyThresholdMs`).
- **NFR-228-E** All TypeScript types must be explicit; `noImplicitAny` strict mode must be satisfied.

---

## 4. BDD Acceptance Scenarios

### BDD-1159 — Token Bucket Admission Under Capacity

```gherkin
SCENARIO: Requests admitted when tokens available and cwnd allows
  GIVEN a limiter with capacity=10, refillRate=1000/s, cwnd=10
  WHEN 10 requests are submitted in rapid succession
  THEN all 10 decisions MUST be ADMIT
  AND the in-flight counter MUST equal 10
```

### BDD-1160 — THROTTLE When In-Flight Saturates cwnd

```gherkin
SCENARIO: Requests throttled when in-flight reaches cwnd ceiling
  GIVEN a limiter with capacity=10, cwnd=5, and 5 in-flight requests
  WHEN a 6th request arrives (tokens available)
  THEN the decision MUST be THROTTLE
  AND the token bucket balance MUST remain unchanged
```

### BDD-1161 — REJECT When Token Bucket Empty

```gherkin
SCENARIO: Requests rejected when token bucket is exhausted
  GIVEN a limiter with capacity=5 and 5 tokens consumed
  WHEN a 6th request arrives
  THEN the decision MUST be REJECT
  AND inFlight MUST NOT be incremented
```

### BDD-1162 — AIMD Multiplicative Decrease on High P99

```gherkin
SCENARIO: cwnd shrinks multiplicatively when P99 exceeds threshold
  GIVEN a limiter with cwnd=20, latencyThresholdMs=50, beta=0.5
  WHEN complete() is called with latencyMs=100 (P99 >= threshold)
  THEN cwnd MUST become floor(20 * 0.5) = 10
  AND cwnd MUST NOT fall below MIN_CWND
```

### BDD-1163 — AIMD Additive Increase on Low P99

```gherkin
SCENARIO: cwnd grows additively when P99 is below threshold
  GIVEN a limiter with cwnd=10, latencyThresholdMs=50, alpha=1
  WHEN complete() is called with latencyMs=10 (P99 < threshold)
  THEN cwnd MUST become 11
  AND cwnd MUST NOT exceed MAX_CWND
```

---

## 5. Architecture

```
EosAdaptiveCongestionRateLimiterCore
  ├── TokenBucketState  { tokens: number, lastRefill: bigint }
  ├── SlidingHdrHistogram  { buckets[1024]: number[], windowMs: number }
  ├── AimdState  { cwnd: number, inFlight: number }
  └── Methods
       ├── admit(): AdmissionDecision
       ├── complete(latencyMs: number): void
       └── stats(): RateLimiterStats
```

### HDR Histogram Bucket Mapping

- Buckets cover latency range `[0, 65535]` ms.
- Bucket index: `bucketIndex(ms) = Math.min(1023, Math.floor(Math.log2(ms + 1) * 128))`
- P99 computed by iterating buckets until cumulative count ≥ `0.99 * total`.
- Sliding window: each sample stamped with `Date.now()`; expired samples subtracted from bucket counts when window exceeds `WINDOW_MS`.

---

## 6. Done Criteria

- [ ] `src/core/eosAdaptiveCongestionRateLimiterCore.types.ts` created
- [ ] `src/core/eosAdaptiveCongestionRateLimiterCore.ts` created — 0 lint / type errors
- [ ] `test/eosAdaptiveCongestionRateLimiterCore.test.mjs` — BDD-1159..BDD-1163 all PASS
- [ ] CLI + MCP wired
- [ ] Barrel + subpath exports added
- [ ] DEVELOPER_GUIDE.md updated (Module 43)
- [ ] `tip-refresh` run, counters updated
- [ ] Git commit sealed, Freeze Pin updated
- [ ] Fleet Soundcheck 9/9 A+ post-commit
