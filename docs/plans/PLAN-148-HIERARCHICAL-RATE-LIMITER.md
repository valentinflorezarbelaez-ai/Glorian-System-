# PLAN-148: Hierarchical Multi-Algorithm Rate Limiting & Traffic Shaping Governor

- **Change ID**: `CHANGE-148`
- **Spec ID**: `SPEC-286`
- **Component**: `Glorian System Core / Concurrency & Traffic Control`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy & Patterns

### 1.1 Dual-Algorithm Design

Traffic demands vary fundamentally based on workload characteristics:

1. **Token Bucket**: Optimized for bursty interactive workloads (REST APIs, GraphQL queries, search endpoints) where clients need to fire bursts up to `burstCapacity` but must respect an average replenishment rate $r$.
2. **Leaky Bucket**: Optimized for queue smoothing, worker ingestion, and asynchronous jobs where traffic must be delivered downstream at a steady, non-bursting rate $d$.

### 1.2 Mathematical Formulation

For a Token Bucket $(C, r)$ with capacity $C$ and rate $r$ (tokens/sec):
$$\Delta t = \max(0, t_{\text{now}} - t_{\text{last}})$$
$$\text{tokens}(t) = \min(C, \text{tokens}(t_{\text{last}}) + \Delta t \times r)$$
A request demanding $k$ tokens succeeds if $\text{tokens}(t) \ge k$, updating:
$$\text{tokens}_{\text{new}} = \text{tokens}(t) - k, \quad t_{\text{last}} = t_{\text{now}}$$

For a Leaky Bucket $(Q, d)$ with queue capacity $Q$ and drain rate $d$ (drops/sec):
$$\Delta t = \max(0, t_{\text{now}} - t_{\text{last}})$$
$$\text{drops}(t) = \max(0, \text{drops}(t_{\text{last}}) - \Delta t \times d)$$
A request adding $k$ drops succeeds if $\text{drops}(t) + k \le Q$, updating:
$$\text{drops}_{\text{new}} = \text{drops}(t) + k, \quad t_{\text{last}} = t_{\text{now}}$$

### 1.3 Hierarchical Domain Resolution

In multi-tenant cloud platforms, limits must be evaluated across a directed hierarchy:
$$\text{Path} = [ \text{Tier}_1, \text{Tier}_2, \dots, \text{Tier}_m ]$$
e.g., `["global", "tenant:acme", "client:192.168.1.50", "endpoint:POST/orders"]`.
Evaluation proceeds in cascade:

1. Every tier is checked.
2. If any tier fails, the entire transaction is rejected, identifying the rejecting tier.
3. If all tiers pass, tokens/drops are debited across all tiers atomically.

---

## 2. Architecture Decision Record (ADR)

### ADR-148.1: Monotonic High-Resolution Timing vs. System Clock

- **Context**: `Date.now()` is subject to NTP clock adjustments, manual time changes, and leap seconds, which can yield negative $\Delta t$ or sudden massive token replenishment.
- **Decision**: Use monotonic nanosecond clock offsets (`process.hrtime.bigint()` converted to millisecond floating point, or monotonic delta ticks), with a clamp $\Delta t = \max(0, \dots)$.
- **Status**: ACCEPTED.
- **Consequences**: Deterministic, strictly forward-moving time math regardless of host OS clock corrections.

### ADR-148.2: In-Memory Zero-Dependency Pure Layer-0 Governor

- **Context**: External rate limiting tools (e.g., Redis `ratelimit` scripts) introduce network I/O, latency overhead, and external infrastructure requirements.
- **Decision**: Implement a pure Layer-0 in-memory rate limiter with TTL-based sliding-window eviction of idle domain keys.
- **Status**: ACCEPTED.
- **Consequences**: Zero external dependencies (Law V), sub-microsecond evaluation latency, and zero I/O jitter.

---

## 3. Rejected Alternatives

1. **Fixed-Window Counter**:
   - Rejected because requests clustered at window boundaries double the allowable throughput.
2. **Sliding-Window Log (Storing every timestamp)**:
   - Rejected because memory consumption scales linearly $O(N)$ with request volume, risking unbounded heap allocations. Token Bucket and Leaky Bucket are $O(1)$ space per key.
