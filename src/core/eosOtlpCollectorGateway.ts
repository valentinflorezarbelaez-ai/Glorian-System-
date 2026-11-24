/**
 * EOS Sovereign Architecture - Layer 0
 * OpenTelemetry Distributed Tracing & High-Throughput OTLP Collector Gateway
 * SPEC-278 / CHANGE-140
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";

export interface OtlpGatewaySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  durationMs: number;
  attributes: Record<string, unknown>;
  status: {
    code: number;
    message?: string;
  };
}

export interface SamplingDecision {
  span: OtlpGatewaySpan;
  retained: boolean;
  reason: "ERROR_STATUS" | "LATENCY_OUTLIER" | "BASELINE_SAMPLED" | "DROPPED_NOMINAL";
}

export interface OtlpCollectorOptions {
  maxBufferSize?: number;
  sampleRate?: number; // 0.0 to 1.0 (e.g. 0.05 = 5%)
  latencyThresholdMs?: number; // default 250ms
  evidencePath?: string;
}

export interface OtlpMetricsSummary {
  totalIngested: number;
  totalRetained: number;
  totalDropped: number;
  retentionRatio: number;
  errorCount: number;
  errorRate: number;
  latencyOutlierCount: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
}

export interface OtlpReceipt {
  schemaVersion: "1.0.0";
  timestamp: string;
  metrics: OtlpMetricsSummary;
  evidenceSha256: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export class EosOtlpCollectorGateway {
  private readonly maxBufferSize: number;
  private readonly defaultSampleRate: number;
  private readonly defaultLatencyThresholdMs: number;
  private readonly evidencePath: string;

  private buffer: OtlpGatewaySpan[] = [];
  private decisions: SamplingDecision[] = [];

  constructor(options: OtlpCollectorOptions = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 10000;
    this.defaultSampleRate = options.sampleRate ?? 0.05;
    this.defaultLatencyThresholdMs = options.latencyThresholdMs ?? 250;
    this.evidencePath = options.evidencePath ?? resolveEvidencePath("OTEL_RECEIPT.json");
  }

  public parsePayload(payload: string | Record<string, unknown>): OtlpGatewaySpan[] {
    const raw = typeof payload === "string" ? JSON.parse(payload) : payload;
    const extracted: OtlpGatewaySpan[] = [];

    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (this.isValidSpan(item)) extracted.push(this.normalizeSpan(item));
      }
      return extracted;
    }

    if (raw && typeof raw === "object" && Array.isArray(raw.resourceSpans)) {
      for (const resSpan of raw.resourceSpans) {
        const globalAttrs = this.extractAttributes(resSpan.resource?.attributes);
        if (Array.isArray(resSpan.scopeSpans)) {
          for (const scpSpan of resSpan.scopeSpans) {
            if (Array.isArray(scpSpan.spans)) {
              for (const sp of scpSpan.spans) {
                const spanAttrs = { ...globalAttrs, ...this.extractAttributes(sp.attributes) };
                extracted.push(this.normalizeSpan(sp, spanAttrs));
              }
            }
          }
        }
      }
      return extracted;
    }

    if (raw && typeof raw === "object" && Array.isArray(raw.spans)) {
      for (const sp of raw.spans) {
        if (this.isValidSpan(sp)) extracted.push(this.normalizeSpan(sp));
      }
      return extracted;
    }

    return extracted;
  }

  private extractAttributes(attrs: unknown): Record<string, unknown> {
    const res: Record<string, unknown> = {};
    if (!Array.isArray(attrs)) return res;
    for (const item of attrs) {
      if (item && typeof item === "object" && typeof item.key === "string" && item.value) {
        const valObj = item.value;
        const val = valObj.stringValue ?? valObj.intValue ?? valObj.doubleValue ?? valObj.boolValue ?? valObj;
        res[item.key] = val;
      }
    }
    return res;
  }

  private isValidSpan(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;
    const candidate = obj as Record<string, unknown>;
    return typeof candidate.traceId === "string" && typeof candidate.spanId === "string";
  }

  private normalizeSpan(raw: Record<string, unknown>, extraAttrs: Record<string, unknown> = {}): OtlpGatewaySpan {
    const traceId = String(raw.traceId || "");
    const spanId = String(raw.spanId || "");
    const parentSpanId = raw.parentSpanId ? String(raw.parentSpanId) : undefined;
    const name = String(raw.name || "unnamed_span");
    const kind = typeof raw.kind === "number" ? raw.kind : undefined;

    let durationMs = 0;
    if (typeof raw.durationMs === "number") {
      durationMs = raw.durationMs;
    } else if (raw.startTimeUnixNano && raw.endTimeUnixNano) {
      const start = BigInt(String(raw.startTimeUnixNano));
      const end = BigInt(String(raw.endTimeUnixNano));
      durationMs = Number(end - start) / 1_000_000;
    }

    const attrs = {
      ...extraAttrs,
      ...(typeof raw.attributes === "object" && raw.attributes && !Array.isArray(raw.attributes)
        ? (raw.attributes as Record<string, unknown>)
        : {}),
    };

    let statusCode = 1;
    let statusMsg: string | undefined;
    if (raw.status && typeof raw.status === "object") {
      const st = raw.status as Record<string, unknown>;
      statusCode = typeof st.code === "number" ? st.code : 1;
      if (typeof st.message === "string") statusMsg = st.message;
    }

    return {
      traceId,
      spanId,
      parentSpanId,
      name,
      kind,
      startTimeUnixNano: raw.startTimeUnixNano as string | number | undefined,
      endTimeUnixNano: raw.endTimeUnixNano as string | number | undefined,
      durationMs: Math.max(0, durationMs),
      attributes: attrs,
      status: { code: statusCode, message: statusMsg },
    };
  }

  public evaluateSampling(
    spans: OtlpGatewaySpan[],
    sampleRate = this.defaultSampleRate,
    latencyThresholdMs = this.defaultLatencyThresholdMs,
  ): SamplingDecision[] {
    const decisions: SamplingDecision[] = [];

    for (const span of spans) {
      const isError =
        span.status?.code === 2 ||
        Number(span.attributes?.["http.status_code"]) >= 500 ||
        span.attributes?.["error"] === true;

      if (isError) {
        decisions.push({ span, retained: true, reason: "ERROR_STATUS" });
        continue;
      }

      if (span.durationMs >= latencyThresholdMs) {
        decisions.push({ span, retained: true, reason: "LATENCY_OUTLIER" });
        continue;
      }

      if (sampleRate >= 1.0) {
        decisions.push({ span, retained: true, reason: "BASELINE_SAMPLED" });
        continue;
      }

      if (sampleRate <= 0.0) {
        decisions.push({ span, retained: false, reason: "DROPPED_NOMINAL" });
        continue;
      }

      const seed = hashString(`${span.traceId}:${span.spanId}`);
      const roll = (seed % 10000) / 10000;
      if (roll < sampleRate) {
        decisions.push({ span, retained: true, reason: "BASELINE_SAMPLED" });
      } else {
        decisions.push({ span, retained: false, reason: "DROPPED_NOMINAL" });
      }
    }

    return decisions;
  }

  public ingestSpans(
    payload: string | Record<string, unknown>,
    options?: { sampleRate?: number; latencyThresholdMs?: number },
  ): { status: "PASS" | "ERROR"; totalIngested: number; retainedCount: number; errors: string[] } {
    try {
      const parsed = this.parsePayload(payload);
      if (parsed.length === 0) {
        return { status: "PASS", totalIngested: 0, retainedCount: 0, errors: [] };
      }

      const newDecisions = this.evaluateSampling(
        parsed,
        options?.sampleRate ?? this.defaultSampleRate,
        options?.latencyThresholdMs ?? this.defaultLatencyThresholdMs,
      );

      for (const d of newDecisions) {
        this.decisions.push(d);
        if (d.retained) {
          if (this.buffer.length >= this.maxBufferSize) {
            this.buffer.shift(); // Evict oldest retained span (circular buffer)
          }
          this.buffer.push(d.span);
        }
      }

      const retainedCount = newDecisions.filter((d) => d.retained).length;
      return { status: "PASS", totalIngested: parsed.length, retainedCount, errors: [] };
    } catch (err: unknown) {
      return {
        status: "ERROR",
        totalIngested: 0,
        retainedCount: 0,
        errors: [(err as Error).message || String(err)],
      };
    }
  }

  public computeMetrics(spans?: OtlpGatewaySpan[]): OtlpMetricsSummary {
    const targetSpans = spans ?? (this.decisions.length > 0 ? this.decisions.map((d) => d.span) : this.buffer);
    const totalIngested = targetSpans.length;
    if (totalIngested === 0) {
      return {
        totalIngested: 0,
        totalRetained: 0,
        totalDropped: 0,
        retentionRatio: 0,
        errorCount: 0,
        errorRate: 0,
        latencyOutlierCount: 0,
        p50Ms: 0,
        p90Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        meanDurationMs: 0,
        maxDurationMs: 0,
        minDurationMs: 0,
      };
    }

    let errorCount = 0;
    let latencyOutlierCount = 0;
    let totalDuration = 0;
    let maxDuration = -Infinity;
    let minDuration = Infinity;
    const durations: number[] = [];

    for (const span of targetSpans) {
      const dur = span.durationMs;
      durations.push(dur);
      totalDuration += dur;
      if (dur > maxDuration) maxDuration = dur;
      if (dur < minDuration) minDuration = dur;

      const isError =
        span.status?.code === 2 ||
        Number(span.attributes?.["http.status_code"]) >= 500 ||
        span.attributes?.["error"] === true;
      if (isError) errorCount++;
      if (dur >= this.defaultLatencyThresholdMs) latencyOutlierCount++;
    }

    durations.sort((a, b) => a - b);

    const totalRetained =
      this.decisions.length > 0 ? this.decisions.filter((d) => d.retained).length : targetSpans.length;
    const totalDropped = totalIngested - totalRetained;

    return {
      totalIngested,
      totalRetained,
      totalDropped: Math.max(0, totalDropped),
      retentionRatio: totalIngested > 0 ? Number((totalRetained / totalIngested).toFixed(4)) : 0,
      errorCount,
      errorRate: totalIngested > 0 ? Number((errorCount / totalIngested).toFixed(4)) : 0,
      latencyOutlierCount,
      p50Ms: Number(calculatePercentile(durations, 50).toFixed(2)),
      p90Ms: Number(calculatePercentile(durations, 90).toFixed(2)),
      p95Ms: Number(calculatePercentile(durations, 95).toFixed(2)),
      p99Ms: Number(calculatePercentile(durations, 99).toFixed(2)),
      meanDurationMs: Number((totalDuration / totalIngested).toFixed(2)),
      maxDurationMs: Number(maxDuration.toFixed(2)),
      minDurationMs: Number(minDuration.toFixed(2)),
    };
  }

  public getSpans(filter?: { errorsOnly?: boolean; limit?: number }): OtlpGatewaySpan[] {
    let result = [...this.buffer];
    if (filter?.errorsOnly) {
      result = result.filter(
        (s) => s.status.code === 2 || Number(s.attributes["http.status_code"]) >= 500 || s.attributes["error"] === true,
      );
    }
    if (typeof filter?.limit === "number" && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  public getSamplingDecisions(): SamplingDecision[] {
    return [...this.decisions];
  }

  public generateReceipt(outputPath = this.evidencePath): {
    receiptPath: string;
    sha256: string;
    metrics: OtlpMetricsSummary;
  } {
    const metrics = this.computeMetrics();
    const payload = {
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      metrics,
    };
    const content = JSON.stringify(payload, null, 2);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const sealed = { ...payload, evidenceSha256: sha256 };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(sealed, null, 2), "utf8");

    return { receiptPath: outputPath, sha256, metrics };
  }

  public clear(): void {
    this.buffer = [];
    this.decisions = [];
  }
}
