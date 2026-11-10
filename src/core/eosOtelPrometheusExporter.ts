/**
 * GLORIAN SYSTEM — OPENTELEMETRY PROMETHEUS METRICS EXPOSITION EXPORTER (SPEC-187, CHANGE-072)
 *
 * Implements OpenMetrics RFC / Prometheus Text Exposition Format (version 0.0.4):
 * 1. Monotonic operation counters: glorian_requests_total{module="...",status="ok|error"}
 * 2. RED metric quantiles: glorian_request_duration_seconds{module="...",quantile="0.5|0.9|0.99"}
 * 3. Real-time Node.js process memory gauges: glorian_process_memory_bytes{area="..."}
 * 4. System info and uptime indicators.
 *
 * Strict Layer-0 Purity: Zero external npm dependencies (runtimeDependenciesCount: 0).
 * Node 24 strip-only TypeScript compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface OperationMetricSummary {
  readonly module: string;
  readonly successCount: number;
  readonly errorCount: number;
  readonly totalCount: number;
  readonly totalDurationMs: number;
  readonly p50DurationMs: number;
  readonly p90DurationMs: number;
  readonly p99DurationMs: number;
}

export interface PrometheusMetricsSnapshot {
  readonly timestampIso: string;
  readonly uptimeSeconds: number;
  readonly memoryHeapUsedBytes: number;
  readonly memoryRssBytes: number;
  readonly modules: readonly OperationMetricSummary[];
  readonly sha256Receipt: string;
}

export class EosOtelPrometheusExporter {
  private readonly maxSamplesPerModule: number;
  private readonly counts: Map<string, { ok: number; error: number }> = new Map();
  private readonly durations: Map<string, number[]> = new Map();
  private activeWorkspacesGauge: number = 0;

  constructor(maxSamplesPerModule: number = 500) {
    assertPrecondition(maxSamplesPerModule > 10, "maxSamplesPerModule must be greater than 10");
    this.maxSamplesPerModule = maxSamplesPerModule;
  }

  public recordOperation(module: string, durationMs: number, success: boolean): void {
    assertPrecondition(Boolean(module && module.trim()), "module must be a non-empty string");
    assertPrecondition(Number.isFinite(durationMs) && durationMs >= 0, "durationMs must be a non-negative number");

    const modKey = module.trim().toLowerCase();

    // 1. Update counters
    let count = this.counts.get(modKey);
    if (!count) {
      count = { ok: 0, error: 0 };
      this.counts.set(modKey, count);
    }
    if (success) {
      count.ok += 1;
    } else {
      count.error += 1;
    }

    // 2. Update duration samples
    let sampleList = this.durations.get(modKey);
    if (!sampleList) {
      sampleList = [];
      this.durations.set(modKey, sampleList);
    }
    sampleList.push(durationMs);
    if (sampleList.length > this.maxSamplesPerModule) {
      sampleList.shift();
    }
  }

  public setActiveWorkspacesGauge(count: number): void {
    assertPrecondition(Number.isInteger(count) && count >= 0, "count must be a non-negative integer");
    this.activeWorkspacesGauge = count;
  }

  public reset(): void {
    this.counts.clear();
    this.durations.clear();
    this.activeWorkspacesGauge = 0;
  }

  private computeQuantile(sortedValues: readonly number[], q: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(q * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))];
  }

  public getModuleSummary(module: string): OperationMetricSummary {
    const modKey = module.trim().toLowerCase();
    const count = this.counts.get(modKey) ?? { ok: 0, error: 0 };
    const rawDurations = this.durations.get(modKey) ?? [];
    const sorted = [...rawDurations].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    return deepFreeze({
      module: modKey,
      successCount: count.ok,
      errorCount: count.error,
      totalCount: count.ok + count.error,
      totalDurationMs: sum,
      p50DurationMs: this.computeQuantile(sorted, 0.5),
      p90DurationMs: this.computeQuantile(sorted, 0.9),
      p99DurationMs: this.computeQuantile(sorted, 0.99),
    });
  }

  public exportJson(): PrometheusMetricsSnapshot {
    const mem = process.memoryUsage();
    const modules: OperationMetricSummary[] = [];

    for (const modKey of this.counts.keys()) {
      modules.push(this.getModuleSummary(modKey));
    }

    const timestampIso = new Date().toISOString();
    const rawData = {
      timestampIso,
      memoryHeapUsedBytes: mem.heapUsed,
      modules,
    };
    const sha256Receipt = pureSha256(JSON.stringify(rawData));

    const snapshot: PrometheusMetricsSnapshot = deepFreeze({
      timestampIso,
      uptimeSeconds: process.uptime(),
      memoryHeapUsedBytes: mem.heapUsed,
      memoryRssBytes: mem.rss,
      modules,
      sha256Receipt,
    });

    assertPostcondition(snapshot.sha256Receipt.length === 64, "sha256Receipt must be 64-char hex");
    return snapshot;
  }

  public exportPrometheusText(): string {
    const lines: string[] = [];
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    lines.push("# HELP glorian_system_info Static system metadata and engine version.");
    lines.push("# TYPE glorian_system_info gauge");
    lines.push(`glorian_system_info{version="75.0.0",node="${process.version}",arch="${process.arch}"} 1`);
    lines.push("");

    lines.push("# HELP glorian_process_uptime_seconds Total runtime process uptime in seconds.");
    lines.push("# TYPE glorian_process_uptime_seconds gauge");
    lines.push(`glorian_process_uptime_seconds ${uptime.toFixed(3)}`);
    lines.push("");

    lines.push("# HELP glorian_process_memory_bytes Process memory breakdown in bytes.");
    lines.push("# TYPE glorian_process_memory_bytes gauge");
    lines.push(`glorian_process_memory_bytes{area="heap_used"} ${mem.heapUsed}`);
    lines.push(`glorian_process_memory_bytes{area="heap_total"} ${mem.heapTotal}`);
    lines.push(`glorian_process_memory_bytes{area="rss"} ${mem.rss}`);
    lines.push(`glorian_process_memory_bytes{area="external"} ${mem.external}`);
    lines.push("");

    lines.push("# HELP glorian_active_workspaces Current number of active isolated workspaces.");
    lines.push("# TYPE glorian_active_workspaces gauge");
    lines.push(`glorian_active_workspaces ${this.activeWorkspacesGauge}`);
    lines.push("");

    lines.push("# HELP glorian_requests_total Total number of executed operations by module and status.");
    lines.push("# TYPE glorian_requests_total counter");
    for (const [modKey, count] of this.counts.entries()) {
      lines.push(`glorian_requests_total{module="${modKey}",status="ok"} ${count.ok}`);
      lines.push(`glorian_requests_total{module="${modKey}",status="error"} ${count.error}`);
    }
    lines.push("");

    lines.push("# HELP glorian_request_duration_seconds Quantile latencies in seconds per module.");
    lines.push("# TYPE glorian_request_duration_seconds summary");
    for (const modKey of this.counts.keys()) {
      const summary = this.getModuleSummary(modKey);
      const p50Sec = (summary.p50DurationMs / 1000).toFixed(6);
      const p90Sec = (summary.p90DurationMs / 1000).toFixed(6);
      const p99Sec = (summary.p99DurationMs / 1000).toFixed(6);
      const sumSec = (summary.totalDurationMs / 1000).toFixed(6);

      lines.push(`glorian_request_duration_seconds{module="${modKey}",quantile="0.5"} ${p50Sec}`);
      lines.push(`glorian_request_duration_seconds{module="${modKey}",quantile="0.9"} ${p90Sec}`);
      lines.push(`glorian_request_duration_seconds{module="${modKey}",quantile="0.99"} ${p99Sec}`);
      lines.push(`glorian_request_duration_seconds_sum{module="${modKey}"} ${sumSec}`);
      lines.push(`glorian_request_duration_seconds_count{module="${modKey}"} ${summary.totalCount}`);
    }
    lines.push("");

    return lines.join("\n") + "\n";
  }
}

let defaultExporterInstance: EosOtelPrometheusExporter | null = null;

export function getDefaultPrometheusExporter(): EosOtelPrometheusExporter {
  if (!defaultExporterInstance) {
    defaultExporterInstance = new EosOtelPrometheusExporter();
  }
  return defaultExporterInstance;
}
