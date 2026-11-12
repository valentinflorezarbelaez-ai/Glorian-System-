# PLAN-113 — Layer-0 Adaptive AIMD Congestion Control Rate Limiter

## Metadata

- **Plan ID**: PLAN-113
- **Change ID**: CHANGE-113
- **SPEC ID**: SPEC-228
- **Status**: APPROVED
- **Date**: 2026-11-12

## Architecture Decisions

### ADR-113-001: HDR Histogram with Exponential Bucket Scale

**Decision**: Use a 1024-bucket exponential histogram (log2 scale × 128) covering 0–65535 ms.
**Rationale**: O(1) insert, O(1024) P99 scan (constant). Avoids dynamic allocation. 1024 buckets
give sub-millisecond resolution at low latency and coarser resolution at high latency — appropriate
for P99 estimation where precision at tails matters less than convergence speed.
**Rejected alternatives**:

- T-Digest: Requires dynamic node allocation and merge operations — violates Layer-0 simplicity.
- TDigest-style centroids: Non-deterministic merge order changes P99 by ±2%.
- Rolling array of raw samples: O(N) sort for P99; unbounded memory under sustained load.

### ADR-113-002: AIMD over PID Control

**Decision**: Use AIMD (alpha=1, beta=0.5 defaults) rather than a PID controller.
**Rationale**: AIMD is TCP-proven, parameter-free under stable conditions, and converges in
O(log(MAX_CWND/MIN_CWND)/log(1/BETA)) cycles. PID requires integral anti-windup tuning which
is application-specific and error-prone in a general-purpose library.
**Rejected**: PID controller, Cubic TCP, BBR (all require additional state or external RTT signals).

### ADR-113-003: Sliding Window via Stamped Sample Ring

**Decision**: Each histogram insert appends a `{bucketIdx, timestamp}` entry to a ring buffer
(max 65536 entries). On each insert, the head of the ring is checked; expired entries are
removed by decrementing `buckets[idx]` and advancing head.
**Rationale**: Amortised O(1) removal without background timers (pure sync, no `setInterval`).
**Rejected**: setInterval cleanup timer — introduces asynchronous state mutation that is
hard to test deterministically.

## Implementation Order

1. Types file (interfaces, enums)
2. SlidingHdrHistogram private class
3. EosAdaptiveCongestionRateLimiterCore public class
4. CLI handler
5. MCP wire-up
6. Barrel + subpath exports
7. Test suite
8. Doc update + tip-refresh
