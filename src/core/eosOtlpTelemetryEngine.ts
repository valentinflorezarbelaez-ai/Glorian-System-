/**
 * EOS System — Layer-0 OpenTelemetry (OTLP v1) Wire Protocol Engine (SPEC-099)
 *
 * Implements pure Layer-0 W3C distributed trace propagation and OTLP v1 HTTP/JSON
 * wire protocol serialization for enterprise APM observability (Jaeger, Tempo, Datadog).
 *
 * Governed by SPEC-099, CHANGE-067, FR-358..FR-361, BDD-273, BDD-274 (v75.0.0)
 */

import crypto from "node:crypto";

export const OtlpStatusCode = {
  STATUS_CODE_UNSET: 0,
  STATUS_CODE_OK: 1,
  STATUS_CODE_ERROR: 2
} as const;

export type OtlpStatusCode = typeof OtlpStatusCode[keyof typeof OtlpStatusCode];

export type AttributeValue = string | number | boolean;

export interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string;
  boolValue?: boolean;
  doubleValue?: number;
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1 = INTERNAL, 2 = SERVER, 3 = CLIENT
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  attributes: OtlpKeyValue[];
  status: {
    code: OtlpStatusCode;
    message?: string;
  };
}

export interface OtlpResourceSpans {
  resource: {
    attributes: OtlpKeyValue[];
  };
  scopeSpans: Array<{
    scope: {
      name: string;
      version: string;
    };
    spans: OtlpSpan[];
  }>;
}

export interface OtlpTracePayload {
  resourceSpans: OtlpResourceSpans[];
}

export class EosOtlpTelemetryEngine {
  private readonly maxBufferedSpans: number;
  private readonly activeSpans = new Map<string, OtlpSpan>();
  private readonly completedSpans: OtlpSpan[] = [];
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(options?: {
    maxBufferedSpans?: number;
    serviceName?: string;
    serviceVersion?: string;
  }) {
    this.maxBufferedSpans = options?.maxBufferedSpans ?? 1024;
    this.serviceName = options?.serviceName ?? "eos-system";
    this.serviceVersion = options?.serviceVersion ?? "75.0.0";
  }

  /**
   * Generates a 128-bit hexadecimal trace ID (32 chars).
   */
  public generateTraceId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generates a 64-bit hexadecimal span ID (16 chars).
   */
  public generateSpanId(): string {
    return crypto.randomBytes(8).toString("hex");
  }

  /**
   * Formats a W3C traceparent header string (00-traceId-spanId-flags).
   */
  public formatW3cTraceparent(traceId: string, spanId: string, sampled = true): string {
    const flags = sampled ? "01" : "00";
    return `00-${traceId}-${spanId}-${flags}`;
  }

  /**
   * Parses a W3C traceparent header string.
   */
  public parseW3cTraceparent(header: string): { traceId: string; spanId: string; sampled: boolean } | null {
    const parts = header.trim().split("-");
    if (parts.length !== 4 || parts[0] !== "00") return null;
    return {
      traceId: parts[1],
      spanId: parts[2],
      sampled: parts[3] === "01"
    };
  }

  /**
   * Starts a new traced span.
   */
  public startSpan(
    name: string,
    options?: {
      parentTraceId?: string;
      parentSpanId?: string;
      attributes?: Record<string, AttributeValue>;
      kind?: number;
    }
  ): OtlpSpan {
    const traceId = options?.parentTraceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const nowNano = (BigInt(Date.now()) * 1000000n).toString();

    const formattedAttrs: OtlpKeyValue[] = [];
    if (options?.attributes) {
      for (const [k, v] of Object.entries(options.attributes)) {
        formattedAttrs.push(this.formatKeyValue(k, v));
      }
    }

    const span: OtlpSpan = {
      traceId,
      spanId,
      parentSpanId: options?.parentSpanId,
      name,
      kind: options?.kind ?? 1, // SPAN_KIND_INTERNAL
      startTimeUnixNano: nowNano,
      attributes: formattedAttrs,
      status: {
        code: OtlpStatusCode.STATUS_CODE_UNSET
      }
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  /**
   * Ends an active span and moves it to completed batch buffer.
   */
  public endSpan(
    spanId: string,
    status: OtlpStatusCode = OtlpStatusCode.STATUS_CODE_OK,
    errorMessage?: string,
    extraAttributes?: Record<string, AttributeValue>
  ): OtlpSpan | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    span.endTimeUnixNano = (BigInt(Date.now()) * 1000000n).toString();
    span.status = {
      code: status,
      message: errorMessage
    };

    if (extraAttributes) {
      for (const [k, v] of Object.entries(extraAttributes)) {
        span.attributes.push(this.formatKeyValue(k, v));
      }
    }

    this.activeSpans.delete(spanId);

    // Enforce memory-bounded FIFO ring buffer
    if (this.completedSpans.length >= this.maxBufferedSpans) {
      this.completedSpans.shift(); // Drop oldest
    }
    this.completedSpans.push(span);

    return span;
  }

  /**
   * Serializes buffered completed spans into an OTLP v1 HTTP/JSON payload.
   */
  public exportOtlpJsonBatch(clearBuffer = true): OtlpTracePayload {
    const spansToExport = clearBuffer
      ? this.completedSpans.splice(0, this.completedSpans.length)
      : [...this.completedSpans];

    const payload: OtlpTracePayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: this.serviceName } },
              { key: "service.version", value: { stringValue: this.serviceVersion } },
              { key: "telemetry.sdk.name", value: { stringValue: "eos-otlp-tracer" } },
              { key: "telemetry.sdk.language", value: { stringValue: "typescript-l0" } }
            ]
          },
          scopeSpans: [
            {
              scope: {
                name: "eos-system-tracer",
                version: this.serviceVersion
              },
              spans: spansToExport
            }
          ]
        }
      ]
    };

    return payload;
  }

  public getCompletedSpanCount(): number {
    return this.completedSpans.length;
  }

  public getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  private formatKeyValue(key: string, value: AttributeValue): OtlpKeyValue {
    if (typeof value === "string") {
      return { key, value: { stringValue: value } };
    }
    if (typeof value === "boolean") {
      return { key, value: { boolValue: value } };
    }
    if (Number.isInteger(value)) {
      return { key, value: { intValue: value.toString() } };
    }
    return { key, value: { doubleValue: value } };
  }
}
