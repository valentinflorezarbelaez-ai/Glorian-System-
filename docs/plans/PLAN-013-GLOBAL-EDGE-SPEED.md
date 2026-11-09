# ARCHITECTURE PLAN & ADR: GLOBAL EDGE ANYCAST ARBITER & SPEED MESH (PLAN-013)

## 1. Architectural Decision Record (ADR-027)

### Context

EOS operates as a global control plane for sovereign software fleets. Coordinating telemetry, health probes, and event streams across multiple continents requires:

1. Minimizing physical RTT by routing clients to optimal Points of Presence (POPs).
2. Truncating the long tail of distributed latency (p99) caused by network jitter and queue stalls.
3. Preserving strict causal event ordering without relying on synchronized GPS atomic clocks (Google Spanner TrueTime) or slow distributed locks (Raft/Paxos leader consensus).

### Alternatives Considered & Rejected

1. **Google Spanner TrueTime Hardware Model**:
   - _Rejected_: Requires atomic clocks and GPS receivers in each physical rack. Impractical for serverless edge runtimes.
2. **Centralized Global Redis / Memcached Cluster**:
   - _Rejected_: Introduces single-region bottlenecks, cross-continental transit latency (150ms+ from Asia/LATAM), and external runtime dependencies violating Layer-0 purity.
3. **Simple DNS Round-Robin**:
   - _Rejected_: Blind to real-time POP load, network congestion, and physical geographic coordinates.

### Decision

Implement `EosGlobalEdgeArbiter` in pure Layer-0 TypeScript (`dependencies: {}`):

- **Haversine Geodesic Distance Engine**: Calculates precise physical spherical distance ($R = 6371 \text{ km}$) and estimated glass fiber RTT ($c_{fiber} = 200 \text{ km/ms}$).
- **Jeff Dean Hedged Requests Simulator**: Models primary request + hedged backup request after p95 threshold, computing empirical p99 tail reduction.
- **Kulkarni Hybrid Logical Clock (HLC)**: Tuple `(l, c)` providing physical UTC wall time combined with monotonic logical tick for zero-lock causal consistency.
- **Microsecond In-Memory Edge Cache**: Array-backed LRU cache with Merkle-addressed invalidation.
