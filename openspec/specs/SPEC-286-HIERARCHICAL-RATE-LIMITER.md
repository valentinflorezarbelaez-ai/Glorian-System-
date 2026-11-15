# SPEC-286: Hierarchical Multi-Algorithm Rate Limiting & Traffic Shaping Governor

- **Specification ID**: `SPEC-286`
- **Change ID**: `CHANGE-148`
- **Status**: `APPROVED`
- **Module**: `src/core/eosRateLimitingGovernor.ts`
- **Tier**: Planetary Traffic Shaping / Edge Rate Limiting
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-286-01 (Event-Driven Token Bucket)**: WHEN an incoming request claims $k$ tokens under a Token Bucket domain, THE SYSTEM SHALL replenish available tokens proportionally to elapsed monotonic time up to `burstCapacity` and grant the request if and only if available tokens $\ge k$.
- **FR-286-02 (State-Driven Leaky Bucket)**: WHILE requests arrive into a Leaky Bucket domain, THE SYSTEM SHALL drain queued drops at a constant `drainRatePerSec`, accepting requests if current drops $+ k \le \text{queueCapacity}$ and queueing or rejecting overflow deterministically.
- **FR-286-03 (Hierarchical Cascade Isolation)**: WHEN a request specifies a multi-tier domain path (`global` $\to$ `tenant` $\to$ `client` $\to$ `endpoint`), THE SYSTEM SHALL evaluate all tiers in order, rejecting immediately if any tier is exhausted and attributing the rejection to the strictest exhausted tier.
- **FR-286-04 (Monotonic Nanosecond Clock)**: THE SYSTEM SHALL compute all elapsed replenishment durations using monotonic clock offsets (`process.hrtime.bigint()` or monotonic delta ticks), guaranteeing strictly non-negative $\Delta t$ immune to wall-clock NTP slews.
- **FR-286-05 (RFC 6585 Standard Telemetry)**: WHEN a rate limit evaluation occurs, THE SYSTEM SHALL emit standardized rate limit metadata (`limit`, `remaining`, `resetInMs`, `retryAfterSec`) compliant with RFC 6585 and IETF RateLimit headers.
- **FR-286-06 (Cryptographic Attestation Receipt)**: WHEN an audit or simulation run finishes, THE SYSTEM SHALL generate a verifiable JSON receipt at `docs/evidence/RATE_LIMITER_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1491 Token Bucket Replenishment and Burst Capacity Invariant
  GIVEN a Token Bucket initialized with burstCapacity 10 and refillRatePerSec 5
  WHEN 10 tokens are consumed in immediate succession
  THEN all 10 requests are granted and available tokens reach 0
  AND an 11th request in the same instant is rejected with retryAfterSec > 0
  AND after 1000ms of simulated monotonic time, at least 5 tokens have replenished.

SCENARIO: BDD-1492 Leaky Bucket Continuous Drain and Buffer Overflow Protection
  GIVEN a Leaky Bucket initialized with queueCapacity 5 and drainRatePerSec 2
  WHEN 5 drops are added into the queue
  THEN all 5 drops are accepted and queue utilization reaches 100%
  AND an additional 6th drop is immediately rejected due to buffer capacity overflow
  AND after 1000ms of monotonic drain, at least 2 slots become free.

SCENARIO: BDD-1493 Hierarchical Cascaded Domain Isolation
  GIVEN a multi-tier rate limiter configured with global limit 100, tenant limit 10, and client limit 3
  WHEN client A issues 3 requests
  THEN all 3 requests pass through global, tenant, and client tiers
  AND a 4th request from client A is rejected at the client tier
  AND requests from client B under the same tenant continue to be granted up to tenant limits.

SCENARIO: BDD-1494 Monotonic Clock Resilience Against Backward Clock Jumps
  GIVEN a Token Bucket evaluated at time T0
  WHEN an anomalous negative elapsed time or backward clock step is simulated
  THEN the governor clamps delta time to 0
  AND does not decrement or corrupt the current token balance.

SCENARIO: BDD-1495 RFC 6585 RateLimit Header Computation
  GIVEN any rate limit consumption evaluation
  WHEN the governor returns a decision
  THEN the result contains standard RFC 6585 fields: limit, remaining, resetInMs, and retryAfterSec
  AND when rejected, retryAfterSec accurately reflects the wait duration until tokens replenish.

SCENARIO: BDD-1496 Cryptographic Audit Receipt Verification
  GIVEN a multi-tier traffic simulation executed via toolchain:ratelimit:audit
  WHEN the audit completes
  THEN docs/evidence/RATE_LIMITER_RECEIPT.json is written
  AND the receipt contains totalEvaluations, rejectionRate, and a valid sha256Signature.
```
