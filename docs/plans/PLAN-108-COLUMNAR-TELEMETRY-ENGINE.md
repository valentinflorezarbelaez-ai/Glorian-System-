# PLAN-108: Architecture Plan & ADR-108 — In-Memory Columnar Telemetry Slice Engine & Real-Time Anomaly Detector

## Status

`APPROVED` — Governed by SPEC-108, Level 2+ Implementation Authorization.

---

## 1. Context & Problem Statement

Big Tech platforms (Meta SCUBA, Google Monarch / Dremel, Netflix Atlas) handle immense telemetry volume by avoiding row-oriented JSON object serialization. In Node.js, storing telemetry samples as arrays of JavaScript objects produces:

1. Significant garbage collection overhead from constant allocation and deallocation of temporary telemetry objects.
2. Unfavorable CPU memory cache locality due to scattered pointer dereferencing across the V8 heap.
3. Sub-optimal query performance when computing percentiles ($P_{50}, P_{90}, P_{99}$) and anomaly standard deviations across thousands of events.

## 2. Decision: Pure Layer-0 Columnar Engine with TypedArrays & Dictionary Encoding

We introduce `EosColumnarTelemetryEngine` in `src/core/eosColumnarTelemetryEngine.ts`:

1. **Contiguous Storage Columns**:
   - `timestamps`: `Uint32Array` (relative unix seconds / epoch offsets)
   - `latencies`: `Float64Array` (millisecond execution times)
   - `statusCodes`: `Uint16Array` (HTTP status codes: 200, 404, 500, etc.)
   - `repoIds`: `Uint16Array` (dictionary-encoded index for fleet repositories)
   - `stages`: `Uint16Array` (dictionary-encoded index for canary/deployment stages)
2. **Circular Ring Overwrite**:
   - Fixed capacity (default: 50,000 samples) ensuring strictly bounded memory usage ($O(1)$ leak-proof footprint).
3. **Dictionary Encoding**:
   - Bi-directional map (`string -> uint16` and `uint16 -> string`) for instant $O(1)$ dimensional lookup without string duplication.
4. **Zero-Allocation Vector Queries & Anomaly Scoring**:
   - Fast linear scans across contiguous Float64 memory.
   - Streaming Exponential Moving Average (EMA) and variance calculation for real-time $Z$-score anomaly classification ($|Z| > 3.0$).
   - Quickselect/partitioning algorithm for exact percentiles ($P_{50}, P_{90}, P_{99}$) in under 1 millisecond.

## 3. Rejected Alternatives

- **Alternative A (SQLite / In-Memory SQL Table)**:
  - _Rejected_: While SQLite is present in EOS for durable ledgering, executing SQL queries for microsecond high-frequency telemetry loops introduces query parsing and bridging overhead.
- **Alternative B (Third-Party Columnar DB / DuckDB / Apache Arrow npm dependency)**:
  - _Rejected_: Violates Law V (Hexagonal Isolation) and Law VII (Layer 0 Purity — zero external runtime npm dependencies).
- **Alternative C (Traditional Array of JSON Objects with Array.prototype.filter/map)**:
  - _Rejected_: Violates sub-millisecond execution constraints and causes GC pressure under sustained event flow.

## 4. Architectural Boundaries

```
[Fleet Repositories & Canary Deployments]
                     │
                     ▼
  [Layer 1 Adapters: eos_columnar_telemetry_query MCP Tool]
                     │
                     ▼
  [Layer 0 Pure Domain: EosColumnarTelemetryEngine]
   ├─ Contiguous TypedArray Columns (Float64 / Uint32 / Uint16)
   ├─ Dictionary Encoder (Bijections)
   ├─ Real-Time Welford / EMA Z-Score Anomaly Detector
   └─ Sub-Millisecond Quickselect Percentile Aggregator
                     │
                     ▼
       [Deterministic SHA-256 Analysis Receipts]
```
