# SPEC-278: OPENTELEMETRY DISTRIBUTED TRACING & HIGH-THROUGHPUT OTLP COLLECTOR GATEWAY

## 1. Metadata

- **Specification ID**: `SPEC-278`
- **Change Reference**: `CHANGE-140`
- **Component**: `EosOtlpCollectorGateway`
- **Status**: `APPROVED`
- **Version**: `1.0.0`
- **Classification**: Layer 0 Sovereign Telemetry & Distributed Observability Core

---

## 2. Functional Requirements (EARS Syntax)

- **FR-278-01 (Event-Driven: OTLP Span Ingestion & Validation)**:
  `WHEN` standard OpenTelemetry span batches (OTLP JSON format or in-memory resource spans) are ingested via `ingestSpans`,
  `THE SYSTEM SHALL` parse, validate required W3C TraceContext identifiers (`traceId`, `spanId`), and buffer valid spans into a memory-bounded ring buffer.

- **FR-278-02 (State-Driven: 100% Tail-Based Error Span Retention)**:
  `WHILE` evaluating sampling retention on an ingested trace,
  `THE SYSTEM SHALL` unconditionally retain 100% of spans belonging to any trace that contains an error status (`status.code === 2` or `ERROR`) or HTTP status code $\ge 500$.

- **FR-278-03 (State-Driven: 100% Tail-Based Latency Outlier Retention)**:
  `WHILE` evaluating span duration against the configured latency threshold (e.g. `latencyThresholdMs`, default 250ms),
  `THE SYSTEM SHALL` retain 100% of outlier traces exceeding the threshold regardless of error status.

- **FR-278-04 (Event-Driven: Probabilistic Baseline Down-Sampling)**:
  `WHEN` nominal happy-path spans (error-free, latency within threshold) are processed,
  `THE SYSTEM SHALL` apply the configured baseline sample rate (e.g., `sampleRate: 0.05`), deterministically down-sampling nominal spans while maintaining accurate drop and ingest counters.

- **FR-278-05 (Ubiquitous: Percentile Latency & Observability Metrics Aggregation)**:
  `THE SYSTEM SHALL` calculate P50, P90, P95, and P99 latency percentiles, error rates, span throughput, and sampling retention ratios via `computeMetrics`.

- **FR-278-06 (Ubiquitous: Cryptographic Audit Receipt)**:
  `THE SYSTEM SHALL` write telemetry ingest, sampling, and percentile statistics to `docs/evidence/OTEL_RECEIPT.json` sealed with a SHA-256 digest.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-1443: Compliant OTLP Span Ingestion and Validation
  GIVEN a valid OTLP JSON trace payload with standard resource spans and W3C trace identifiers
  WHEN ingestSpans is executed on the payload
  THEN the report status SHALL be "PASS"
  AND totalIngested SHALL equal the number of spans in the payload
  AND the ring buffer SHALL store valid spans without errors.

SCENARIO: BDD-1444: 100% Tail-Based Sampling Retention for Error Spans
  GIVEN an ingested batch of spans where a span has status.code === 2 (ERROR) or http.status_code === 500
  WHEN evaluateSampling is executed with sampleRate set to 0.0 (drop all nominal)
  THEN the error trace SHALL be retained with 100% retention
  AND the retention reason SHALL be "ERROR_STATUS".

SCENARIO: BDD-1445: 100% Tail-Based Retention for High Latency Outliers
  GIVEN an ingested batch of spans containing a span whose duration exceeds latencyThresholdMs
  WHEN evaluateSampling is executed with sampleRate set to 0.0
  THEN the outlier span SHALL be retained with 100% retention
  AND the retention reason SHALL be "LATENCY_OUTLIER".

SCENARIO: BDD-1446: Uniform Down-Sampling for Nominal Happy-Path Spans
  GIVEN an ingested batch of 100 nominal spans (duration < threshold, status OK)
  WHEN evaluateSampling is executed with sampleRate set to 0.10 (10%)
  THEN approximately 10% of nominal spans SHALL be retained
  AND dropped nominal spans SHALL be counted in droppedNominalSpans.

SCENARIO: BDD-1447: P50/P90/P99 Percentile Latency Calculation
  GIVEN a collection of spans with varying durations
  WHEN computeMetrics is executed
  THEN the returned metrics SHALL compute non-negative p50, p90, p95, and p99 values
  AND p50 SHALL be <= p90
  AND p90 SHALL be <= p99.

SCENARIO: BDD-1448: Cryptographic SHA-256 Observability Receipt Generation
  GIVEN completed span ingestion and metrics computation
  WHEN generateReceipt is executed
  THEN docs/evidence/OTEL_RECEIPT.json SHALL be created
  AND the receipt SHALL include an authentic SHA-256 signature and metrics summary.
```
