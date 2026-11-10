/**
 * GLORIAN SYSTEM — OPENTELEMETRY PROMETHEUS EXPORTER TEST SUITE (SPEC-187, BDD-952..BDD-955)
 *
 * Verifies standard OpenMetrics / Prometheus Text Exposition:
 * - BDD-952: Operation metric recording and counter increments
 * - BDD-953: Canonical Prometheus text exposition formatting with HELP/TYPE directives
 * - BDD-954: Quantile latency calculation (P50, P90, P99)
 * - BDD-955: Process memory gauge emission
 *
 * Strict Layer-0 Purity: Zero third-party dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { EosOtelPrometheusExporter, getDefaultPrometheusExporter } from "../src/core/eosOtelPrometheusExporter.ts";

describe("SPEC-187: OpenTelemetry Prometheus Metrics Exposition Exporter", () => {
  it("BDD-952: Operation metric recording and counter increments", () => {
    const exporter = new EosOtelPrometheusExporter();

    exporter.recordOperation("auth_service", 15.2, true);
    exporter.recordOperation("auth_service", 22.0, true);
    exporter.recordOperation("auth_service", 18.5, true);
    exporter.recordOperation("auth_service", 120.4, false);

    const summary = exporter.getModuleSummary("auth_service");
    assert.equal(summary.module, "auth_service");
    assert.equal(summary.successCount, 3);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.totalCount, 4);
    assert.ok(summary.totalDurationMs > 170);
  });

  it("BDD-953: Canonical Prometheus text exposition formatting with HELP/TYPE directives", () => {
    const exporter = new EosOtelPrometheusExporter();
    exporter.recordOperation("governance", 5.0, true);
    exporter.setActiveWorkspacesGauge(2);

    const text = exporter.exportPrometheusText();

    assert.ok(text.includes("# HELP glorian_system_info"));
    assert.ok(text.includes("# TYPE glorian_system_info gauge"));
    assert.ok(text.includes("# HELP glorian_requests_total"));
    assert.ok(text.includes("# TYPE glorian_requests_total counter"));
    assert.ok(text.includes("# HELP glorian_request_duration_seconds"));
    assert.ok(text.includes("# TYPE glorian_request_duration_seconds summary"));
    assert.ok(text.includes('glorian_requests_total{module="governance",status="ok"} 1'));
    assert.ok(text.includes('glorian_requests_total{module="governance",status="error"} 0'));
    assert.ok(text.includes("glorian_active_workspaces 2"));
  });

  it("BDD-954: Quantile latency calculation preserves monotonic ordering", () => {
    const exporter = new EosOtelPrometheusExporter();

    // Insert 10 samples ranging from 10ms to 100ms
    for (let i = 1; i <= 10; i++) {
      exporter.recordOperation("crypto_engine", i * 10, true);
    }

    const summary = exporter.getModuleSummary("crypto_engine");
    assert.ok(summary.p50DurationMs <= summary.p90DurationMs, "P50 must be <= P90");
    assert.ok(summary.p90DurationMs <= summary.p99DurationMs, "P90 must be <= P99");
    assert.ok(summary.p50DurationMs >= 50, "P50 should be around 50ms");
    assert.ok(summary.p99DurationMs >= 90, "P99 should be around 100ms");
  });

  it("BDD-955: Process memory gauge emission", () => {
    const exporter = new EosOtelPrometheusExporter();
    const text = exporter.exportPrometheusText();

    assert.ok(text.includes('glorian_process_memory_bytes{area="heap_used"}'));
    assert.ok(text.includes('glorian_process_memory_bytes{area="heap_total"}'));
    assert.ok(text.includes('glorian_process_memory_bytes{area="rss"}'));

    const json = exporter.exportJson();
    assert.ok(json.memoryHeapUsedBytes > 0);
    assert.ok(json.memoryRssBytes > 0);
    assert.equal(json.sha256Receipt.length, 64);
  });

  it("CLI command 'otel:metrics --json' outputs valid snapshot", () => {
    const output = execFileSync(process.execPath, [path.join(process.cwd(), "bin/eos.mjs"), "otel:metrics", "--json"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(output.trim());
    assert.ok(parsed.uptimeSeconds >= 0);
    assert.ok(parsed.memoryHeapUsedBytes > 0);
    assert.equal(parsed.sha256Receipt.length, 64);
    assert.ok(parsed.modules.length >= 3);
  });

  it("getDefaultPrometheusExporter returns stable singleton instance", () => {
    const inst1 = getDefaultPrometheusExporter();
    const inst2 = getDefaultPrometheusExporter();
    assert.equal(inst1, inst2);
    assert.ok(inst1 instanceof EosOtelPrometheusExporter);
  });
});
