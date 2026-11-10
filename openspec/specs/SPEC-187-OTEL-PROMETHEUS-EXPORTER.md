# SPEC-187: OpenTelemetry Prometheus Metrics Exposition Exporter

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Observability
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / OpenMetrics RFC / Prometheus Text Format 0.0.4
- **Module**: `src/core/eosOtelPrometheusExporter.ts`
- **Composes**: SPEC-147 (Structured Logging), SPEC-149 (OTel Tracing), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Enterprise cloud platforms require standardized, non-proprietary metrics exposition format so that monitoring agents (Prometheus, VictoriaMetrics, Datadog Agent, Grafana Alloy) can scrape telemetry via HTTP or CLI without protocol translation.

This specification implements `EosOtelPrometheusExporter`, delivering canonical Prometheus text format output with `# HELP`, `# TYPE`, monotonic counters, real-time memory gauges, and quantile histograms for Google SRE Golden Signals (RED metrics) under zero runtime npm dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-952 (Event-Driven - Operation Recording)**: `WHEN an operation completes, THE SYSTEM SHALL record its duration in milliseconds and outcome status (success or failure) against its module label.`

- **FR-953 (Ubiquitous - Canonical Exposition Output)**: `THE SYSTEM SHALL format all tracked metrics according to the Prometheus Text Exposition Format (version 0.0.4), including mandatory HELP and TYPE directives for every metric family.`

- **FR-954 (Ubiquitous - Quantile Latency Calculation)**: `THE SYSTEM SHALL compute the P50, P90, and P99 latency quantiles in seconds for tracked operations with sub-millisecond precision.`

- **FR-955 (Ubiquitous - Memory Telemetry Gauges)**: `THE SYSTEM SHALL emit Node.js runtime process memory metrics (heapUsed, heapTotal, rss, external) as Prometheus gauges.`

- **FR-956 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL generate all Prometheus exposition strings using native string builders and standard math without third-party libraries.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-952 Metric recording and counter increments
  GIVEN an EosOtelPrometheusExporter instance
  WHEN 3 successful operations and 1 failed operation are recorded for module "facade"
  THEN total requests for "facade" with status="ok" equals 3
  AND total requests for "facade" with status="error" equals 1

SCENARIO: BDD-953 Canonical Prometheus text exposition format
  GIVEN an exporter with recorded telemetry
  WHEN exportPrometheusText is called
  THEN output contains "# HELP glorian_requests_total"
  AND output contains "# TYPE glorian_requests_total counter"
  AND output contains "# HELP glorian_request_duration_seconds"
  AND output contains "# TYPE glorian_request_duration_seconds summary"

SCENARIO: BDD-954 Quantile latency calculation
  GIVEN multiple recorded operation latencies
  WHEN metrics are exported
  THEN quantiles 0.5, 0.9, and 0.99 are computed and strictly ordered (P50 <= P90 <= P99)

SCENARIO: BDD-955 Process memory gauge emission
  GIVEN the exporter generating text output
  WHEN output is inspected
  THEN glorian_process_memory_bytes with label area="heap_used" is present with positive integer value
```
