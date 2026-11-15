# INTAKE-148: Hierarchical Multi-Algorithm Rate Limiting & Traffic Shaping Governor

- **Change ID**: `CHANGE-148`
- **Specification ID**: `SPEC-286`
- **Module ID**: `EosRateLimitingGovernor`
- **Domain**: High-Throughput Edge Traffic Shaping, Concurrency Regulation & Distributed Abuse Prevention
- **System Owner**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-15

---

## 1. Context & Background

In distributed cloud infrastructure, microservice meshes, and planetary-scale API gateways (e.g., Cloudflare Workers, AWS WAF, Envoy Proxy, Stripe API Gateway), traffic shaping and rate limiting are critical first-line defenses against cascading overloads, noisy neighbors, and denial-of-service vectors.

Standard naive rate limiters rely on simple fixed-window counters that suffer from:

1. Severe burst boundary spikes (double traffic allowed across window edges).
2. Absence of smooth leaky-bucket queueing for downstream backpressure tolerance.
3. Lack of multi-tier hierarchical evaluation (e.g., global limit vs. per-tenant tier vs. per-client IP vs. per-route endpoint).
4. System clock vulnerability to NTP slews and wall-clock jitter.

Glorian System requires a pure Layer-0, zero-dependency, microsecond-accurate rate limiting and traffic shaping governor combining Token Bucket and Leaky Bucket models with hierarchical cascaded domain isolation, monotonic timing, RFC 6585 compliance, and cryptographic audit attestation.

---

## 2. Requirements Baseline (EARS Syntax)

- **FR-286-01 (Event-Driven Token Bucket)**: WHEN an incoming request claims $k$ tokens under a Token Bucket domain, THE SYSTEM SHALL replenish available tokens proportionally to elapsed monotonic time up to `burstCapacity` and grant the request if and only if available tokens $\ge k$.
- **FR-286-02 (State-Driven Leaky Bucket)**: WHILE requests arrive into a Leaky Bucket domain, THE SYSTEM SHALL drain queued drops at a constant `drainRatePerSec`, accepting requests if current drops $+ k \le \text{queueCapacity}$ and queueing or rejecting overflow deterministically.
- **FR-286-03 (Hierarchical Cascade Isolation)**: WHEN a request specifies a multi-tier domain path (`global` $\to$ `tenant` $\to$ `client` $\to$ `endpoint`), THE SYSTEM SHALL evaluate all tiers in order, rejecting immediately if any tier is exhausted and attributing the rejection to the strictest exhausted tier.
- **FR-286-04 (Monotonic Nanosecond Clock)**: THE SYSTEM SHALL compute all elapsed replenishment durations using monotonic clock offsets (`process.hrtime.bigint()` or monotonic delta ticks), guaranteeing strictly non-negative $\Delta t$ immune to wall-clock NTP slews.
- **FR-286-05 (RFC 6585 Standard Telemetry)**: WHEN a rate limit evaluation occurs, THE SYSTEM SHALL emit standardized rate limit metadata (`limit`, `remaining`, `resetInMs`, `retryAfterSec`) compliant with RFC 6585 and IETF RateLimit headers.
- **FR-286-06 (Cryptographic Attestation Receipt)**: WHEN an audit or simulation run finishes, THE SYSTEM SHALL generate a verifiable JSON receipt at `docs/evidence/RATE_LIMITER_RECEIPT.json` sealed with a SHA-256 signature.

---

## 3. Epistemic Assessment & Evidence Level

- **Epistemic State**: `INTAKE_RECORDED`
- **Target Implementation**: `src/core/eosRateLimitingGovernor.ts`
- **CLI Subcommands**: `toolchain:ratelimit:audit`, `toolchain:ratelimit:consume`, `toolchain:ratelimit:inspect`
- **Test Suite**: `test/eosRateLimitingGovernor.test.mjs` (BDD-1491..BDD-1496)
