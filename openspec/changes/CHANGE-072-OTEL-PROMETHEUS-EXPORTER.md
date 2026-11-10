# CHANGE-072: OpenTelemetry Prometheus Metrics Exposition Exporter

## Intent

Equip Glorian System with a canonical Prometheus Text Exposition Format exporter (RFC OpenMetrics) to allow enterprise scrapers (Datadog, Prometheus, Grafana, CloudWatch) to observe system throughput, error budgets, and tail latencies in real time.

## Scope

- SPEC-187 + `src/core/eosOtelPrometheusExporter.ts`
- Barrel export in `src/core/index.ts`
- CLI command `eos metrics` in `bin/commands/cliPlatform.mjs`
- NPM script `"metrics": "node bin/eos.mjs metrics"` in `package.json`
- Verification suite in `test/eosOtelPrometheusExporter.test.mjs`

## Non-goals

- No third-party metric agents or network daemons bundled
- No external npm dependencies
- No persistent socket listener blocking CLI exits

## Status

APPROVED — owner directive to provide superlative Big Tech telemetry.
