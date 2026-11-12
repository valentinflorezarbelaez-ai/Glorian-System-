# INTAKE-113 — Layer-0 Adaptive AIMD Congestion Control Rate Limiter

## Metadata

- **Intake ID**: INTAKE-113
- **Change ID**: CHANGE-113
- **SPEC ID**: SPEC-228
- **Author**: EOS Engineering System
- **Date**: 2026-11-12
- **Status**: INTAKE_COMPLETE
- **Priority**: HIGH
- **Layer**: Layer-0 (Zero external runtime dependencies)

## Business Context

The Glorian System processes high-throughput event streams, telemetry pipelines, and
cryptographic operation queues. Under burst traffic, uncontrolled request admission leads
to cascading tail-latency explosions. Existing modules (`eosAdaptiveRateLimiter.ts`,
`eosTokenBucketRateLimiter.ts`) provide basic token-bucket admission but lack a closed-loop
congestion-control feedback mechanism. The absence of AIMD (Additive Increase / Multiplicative
Decrease) and latency-aware backpressure means the system cannot self-tune under congestion
without operator intervention.

## Problem Statement

1. **No P99 latency feedback**: Rate limiting decisions are made on throughput alone; tail
   latency degradation is not detected or acted upon.
2. **No AIMD backpressure**: When downstream latency spikes, the admission rate must decrease
   multiplicatively (fast convergence); when latency is nominal, it must increase additively
   (fair sharing).
3. **No congestion window (cwnd)**: There is no Ethernet/TCP-inspired sliding congestion window
   that bounds the number of in-flight requests independently of token replenishment rate.
4. **No sliding-window P99 estimator**: Computing P99 without an efficient sliding histogram
   is prohibitively expensive at high throughput.

## Proposed Solution

Implement `EosAdaptiveCongestionRateLimiterCore` — a pure Layer-0 TypeScript module that
combines:

- **Token Bucket** (capacity C, refill rate r): Governs burst admission.
- **AIMD Congestion Window** (cwnd): Floored at `MIN_CWND`, capped at `MAX_CWND`.
  - Additive Increase: `cwnd += ALPHA` per RTT when P99 < threshold.
  - Multiplicative Decrease: `cwnd *= BETA` when P99 ≥ threshold.
- **Sliding-window HDR histogram P99 estimator**: O(1) amortised, using a 1024-bucket
  exponential-scale histogram with a rolling window of configurable duration (default 10 s).
- **Backpressure signals**: `ADMIT`, `THROTTLE`, `REJECT` — structured admission decisions.

## Scope

- New file: `src/core/eosAdaptiveCongestionRateLimiterCore.ts`
- New file: `src/core/eosAdaptiveCongestionRateLimiterCore.types.ts`
- New file: `test/eosAdaptiveCongestionRateLimiterCore.test.mjs`
- New file: `bin/commands/cliCongestionMesh.mjs`
- Wire in: `bin/commands/cliPlatform.mjs`, `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- Export in: `src/core/index.ts`, `package.json`
- Doc update: `docs/DEVELOPER_GUIDE.md` (Module 43)
- Spec artifacts: `openspec/specs/SPEC-228-*`, `openspec/changes/CHANGE-113-*`

## Constraints

- **Zero external runtime dependencies** (`dependencies: {}` must remain empty)
- Pure TypeScript / Node.js 24 built-ins only
- All arithmetic in `BigInt` for nanosecond precision where needed
- Must be deterministic and thread-safe (single-threaded Node.js event loop)

## Acceptance (High Level)

- P99 estimator accurate to ±5% under synthetic load
- AIMD converges in <10 cycles for step-function congestion events
- All 5 BDD scenarios pass with exit code 0
- Zero lint / type errors
- Layer-0 constraint satisfied (no new `dependencies` entries)
