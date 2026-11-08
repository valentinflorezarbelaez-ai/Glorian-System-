# OPENSPEC BASE SPECIFICATION: GLOBAL EDGE ANYCAST ARBITER & DISTRIBUTED MESH (SPEC-020)

## 1. Scope

Governs geo-distributed Anycast routing, great-circle Haversine propagation calculation, Google Jeff Dean-style Hedged Requests for p99 tail-latency cancellation, Hybrid Logical Clocks (HLC) for causal monotonic ordering, and zero-allocation Edge caching across the 8 Apex Global POPs (Stockholm, Bogotá, São Paulo, Virginia, Silicon Valley, London, Frankfurt, Tokyo).

## 2. Requirements (EARS)

- **UBIQUITOUS**: THE SYSTEM SHALL maintain a deterministic registry of 8 Apex Global Points of Presence (POPs) with exact geodesic coordinates and baseline fiber latency models using zero external runtime dependencies (`dependencies: {}`).
- **EVENT-DRIVEN**: WHEN any client coordinates or region ID are evaluated, THE SYSTEM SHALL calculate great-circle distances via the Haversine formula and rank all POPs by predicted round-trip time (RTT).
- **STATE-DRIVEN**: WHILE routing latency-critical telemetry, THE SYSTEM SHALL execute Hedged Requests: if the primary POP does not respond within the p95 SLA window, THE SYSTEM SHALL dispatch a parallel hedged request to the secondary closest POP and cancel outstanding work upon first resolution.
- **UBIQUITOUS**: THE SYSTEM SHALL stamp all distributed mutations with a Hybrid Logical Clock (HLC) tuple combining physical UTC epoch with a strictly monotonic logical counter to establish causal order across regions.
- **UBIQUITOUS**: THE SYSTEM SHALL operate an in-memory zero-allocation LRU Edge cache with cryptographic Merkle tag invalidation, delivering cached telemetry in under 20 microseconds.

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: Haversine Geo-Distance Calculation & POP Ranking (BDD-050)
  GIVEN client geographic coordinates
  WHEN evaluated against the 8 Apex Global Points of Presence
  THEN great-circle distances are computed with exact trigonometric precision
  AND the closest POP with the lowest predicted RTT is selected for routing.

SCENARIO: Hedged Request Tail-Latency Mitigation (BDD-050)
  GIVEN a latency-critical RPC query dispatched to the primary edge POP
  WHEN the primary response exceeds the configured p95 SLA window
  THEN a parallel hedged request is automatically dispatched to the secondary POP
  AND the first responding result resolves the query while cancelling outstanding work.
```
