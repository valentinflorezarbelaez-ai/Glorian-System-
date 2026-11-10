# PLAN-072: OpenTelemetry Prometheus Metrics Exposition Exporter

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-187, CHANGE-072

## 1. Architectural Strategy

Implement `src/core/eosOtelPrometheusExporter.ts`:

1. **Core Data Structure**: In-memory ring buffer of recent latencies per module + counter maps for request counts by status (`ok`, `error`).
2. **Quantile Computation**: Sorts samples in-place or via slice to compute P50, P90, P99 without heap churn.
3. **OpenMetrics Compliance**: Strictly formats metrics with `# HELP` and `# TYPE` annotations, UTF-8 output, and newline endings.
4. **CLI Integration**: Subcommand `eos metrics` in `bin/commands/cliPlatform.mjs` allowing instant shell piping (`eos metrics | curl ...` or direct scraper evaluation).
