/**
 * SPEC-226 / CHANGE-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine
 *
 * Implements pure Layer-0 OpenTelemetry OTLP/HTTP-JSON span emission and W3C TraceContext
 * propagation with zero external runtime dependencies.
 */

import crypto from "node:crypto";
import { assertPostcondition, assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  OtlpAttributeValue,
  OtlpExportPayload,
  OtlpKeyValue,
  OtlpResourceSpans,
  OtlpSpanWire,
  OtlpTraceExportReport,
  SpanAttributeValue,
  SpanData,
  SpanEvent,
  SpanKind,
  SpanStatus,
  StatusCode,
  TracerConfig,
  W3CTraceContext,
} from "./eosOtlpDistributedTracingCore.types.ts";

export class ActiveSpan {
  private readonly _traceId: string;
  private readonly _spanId: string;
  private readonly _parentSpanId?: string;
  private readonly _name: string;
  private readonly _kind: SpanKind;
  private readonly _startTimeUnixNano: string;
  private readonly _attributes: Map<string, SpanAttributeValue>;
  private readonly _events: SpanEvent[];
  private _status: SpanStatus;
  private _ended: boolean;
  private _endTimeUnixNano?: string;

  constructor(
    traceId: string,
    spanId: string,
    name: string,
    kind: SpanKind,
    startTimeUnixNano: string,
    parentSpanId?: string,
    initialAttributes?: Record<string, SpanAttributeValue>,
  ) {
    this._traceId = traceId;
    this._spanId = spanId;
    this._parentSpanId = parentSpanId;
    this._name = name;
    this._kind = kind;
    this._startTimeUnixNano = startTimeUnixNano;
    this._attributes = new Map<string, SpanAttributeValue>();
    this._events = [];
    this._status = { code: "UNSET" };
    this._ended = false;

    if (initialAttributes) {
      for (const [k, v] of Object.entries(initialAttributes)) {
        this._attributes.set(k, v);
      }
    }
  }

  public get traceId(): string {
    return this._traceId;
  }

  public get spanId(): string {
    return this._spanId;
  }

  public get parentSpanId(): string | undefined {
    return this._parentSpanId;
  }

  public get name(): string {
    return this._name;
  }

  public get isEnded(): boolean {
    return this._ended;
  }

  public setAttribute(key: string, value: SpanAttributeValue): this {
    assertPrecondition(!this._ended, "Cannot modify ended span");
    assertPrecondition(typeof key === "string" && key.length > 0, "Attribute key must be non-empty string");
    this._attributes.set(key, value);
    return this;
  }

  public setAttributes(attributes: Record<string, SpanAttributeValue>): this {
    assertPrecondition(!this._ended, "Cannot modify ended span");
    for (const [k, v] of Object.entries(attributes)) {
      this.setAttribute(k, v);
    }
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): this {
    assertPrecondition(!this._ended, "Cannot add event to ended span");
    assertPrecondition(typeof name === "string" && name.length > 0, "Event name must be non-empty string");
    const nowNano = EosOtlpDistributedTracingCore.nowUnixNano();
    this._events.push({
      name,
      timeUnixNano: nowNano,
      attributes: attributes ? deepFreeze({ ...attributes }) : undefined,
    });
    return this;
  }

  public setStatus(code: StatusCode, description?: string): this {
    assertPrecondition(!this._ended, "Cannot set status on ended span");
    this._status = { code, description };
    return this;
  }

  public end(endTimeUnixNano?: string): SpanData {
    assertPrecondition(!this._ended, "Span already ended");
    this._ended = true;
    let computedEnd = endTimeUnixNano || EosOtlpDistributedTracingCore.nowUnixNano();

    // Guard monotonic time invariant
    const startBig = BigInt(this._startTimeUnixNano);
    let endBig = BigInt(computedEnd);
    if (endBig < startBig) {
      endBig = startBig;
      computedEnd = startBig.toString();
    }
    this._endTimeUnixNano = computedEnd;
    assertPostcondition(endBig >= startBig, "End time must be greater than or equal to start time");

    const attrsObj: Record<string, SpanAttributeValue> = {};
    for (const [k, v] of this._attributes.entries()) {
      attrsObj[k] = v;
    }

    const data: SpanData = {
      traceId: this._traceId,
      spanId: this._spanId,
      parentSpanId: this._parentSpanId,
      name: this._name,
      kind: this._kind,
      startTimeUnixNano: this._startTimeUnixNano,
      endTimeUnixNano: this._endTimeUnixNano,
      attributes: attrsObj,
      events: [...this._events],
      status: { ...this._status },
    };

    return deepFreeze(data);
  }
}

export class EosOtlpDistributedTracingCore {
  public static readonly DEFAULT_SERVICE_NAME = "glorian-system";
  public static readonly DEFAULT_SERVICE_VERSION = "75.0.0";
  public static readonly DEFAULT_MAX_CAPACITY = 1000;
  private static readonly _TIME_ORIGIN_MS: bigint = BigInt(Date.now());
  private static readonly _HRTIME_ORIGIN_NS: bigint = process.hrtime.bigint();

  private readonly _serviceName: string;
  private readonly _serviceVersion: string;
  private readonly _maxCapacity: number;
  private readonly _spans: SpanData[];
  private _overflowCount: number;

  constructor(config: TracerConfig = {}) {
    this._serviceName = config.serviceName || EosOtlpDistributedTracingCore.DEFAULT_SERVICE_NAME;
    this._serviceVersion = config.serviceVersion || EosOtlpDistributedTracingCore.DEFAULT_SERVICE_VERSION;
    this._maxCapacity = config.maxCapacity || EosOtlpDistributedTracingCore.DEFAULT_MAX_CAPACITY;
    this._spans = [];
    this._overflowCount = 0;
  }

  /**
   * Generates a 128-bit (16-byte) random hexadecimal trace ID.
   */
  public static generateTraceId(): string {
    let id = "";
    do {
      id = crypto.randomBytes(16).toString("hex").toLowerCase();
    } while (id === "00000000000000000000000000000000");
    return id;
  }

  /**
   * Generates a 64-bit (8-byte) random hexadecimal span ID.
   */
  public static generateSpanId(): string {
    let id = "";
    do {
      id = crypto.randomBytes(8).toString("hex").toLowerCase();
    } while (id === "0000000000000000");
    return id;
  }

  /**
   * Captures the current wall-clock time in nanoseconds as a string.
   * Monotonically non-decreasing via high-resolution process.hrtime offset.
   */
  public static nowUnixNano(): string {
    const elapsed = process.hrtime.bigint() - EosOtlpDistributedTracingCore._HRTIME_ORIGIN_NS;
    const totalNano = EosOtlpDistributedTracingCore._TIME_ORIGIN_MS * 1_000_000n + (elapsed >= 0n ? elapsed : 0n);
    return totalNano.toString();
  }

  /**
   * Formats a W3C TraceContext into a canonical traceparent header.
   */
  public static formatTraceparent(context: W3CTraceContext): string {
    assertPrecondition(
      typeof context.traceId === "string" && /^[0-9a-f]{32}$/i.test(context.traceId),
      "traceId must be 32 hex characters",
    );
    assertPrecondition(
      typeof context.spanId === "string" && /^[0-9a-f]{16}$/i.test(context.spanId),
      "spanId must be 16 hex characters",
    );
    const flags = (context.traceFlags || "01").padStart(2, "0").slice(0, 2);
    return `00-${context.traceId.toLowerCase()}-${context.spanId.toLowerCase()}-${flags.toLowerCase()}`;
  }

  /**
   * Parses a W3C traceparent header with fail-closed validation.
   */
  public static parseTraceparent(header: string | null | undefined): W3CTraceContext | null {
    if (!header || typeof header !== "string") return null;
    const match = header.trim().match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
    if (!match) return null;

    const traceId = match[1].toLowerCase();
    const spanId = match[2].toLowerCase();
    const traceFlags = match[3].toLowerCase();

    // Reject all-zero traceId or spanId per W3C spec
    if (traceId === "00000000000000000000000000000000") return null;
    if (spanId === "0000000000000000") return null;

    return deepFreeze({
      traceId,
      spanId,
      traceFlags,
    });
  }

  /**
   * Starts a new active span in the tracer.
   */
  public startSpan(
    name: string,
    options: {
      parent?: W3CTraceContext | string;
      kind?: SpanKind;
      attributes?: Record<string, SpanAttributeValue>;
      startTimeUnixNano?: string;
    } = {},
  ): ActiveSpan {
    assertPrecondition(typeof name === "string" && name.trim().length > 0, "Span name must be non-empty");

    let parentContext: W3CTraceContext | null = null;
    if (typeof options.parent === "string") {
      parentContext = EosOtlpDistributedTracingCore.parseTraceparent(options.parent);
    } else if (options.parent) {
      parentContext = options.parent;
    }

    const traceId = parentContext ? parentContext.traceId : EosOtlpDistributedTracingCore.generateTraceId();
    const spanId = EosOtlpDistributedTracingCore.generateSpanId();
    const parentSpanId = parentContext ? parentContext.spanId : undefined;
    const kind = options.kind || "INTERNAL";
    const startTimeUnixNano = options.startTimeUnixNano || EosOtlpDistributedTracingCore.nowUnixNano();

    return new ActiveSpan(traceId, spanId, name, kind, startTimeUnixNano, parentSpanId, options.attributes);
  }

  /**
   * Enqueues a completed span into the tracer's bounded buffer.
   */
  public recordSpan(span: SpanData | ActiveSpan): void {
    const data: SpanData = span instanceof ActiveSpan ? (span.isEnded ? span.end() : span.end()) : span;

    if (this._spans.length >= this._maxCapacity) {
      this._spans.shift(); // Evict oldest to preserve memory bounds
      this._overflowCount++;
    }

    this._spans.push(data);
  }

  /**
   * Exports all buffered spans into canonical OpenTelemetry OTLP/HTTP-JSON format.
   */
  public exportToOtlpJson(): OtlpTraceExportReport {
    const timestamp = Date.now();
    const wireSpans: OtlpSpanWire[] = this._spans.map((s) => this.toWireSpan(s));

    const kindMap: Record<SpanKind, number> = {
      INTERNAL: 1,
      SERVER: 2,
      CLIENT: 3,
      PRODUCER: 4,
      CONSUMER: 5,
    };

    const statusMap: Record<StatusCode, number> = {
      UNSET: 0,
      OK: 1,
      ERROR: 2,
    };

    const payload: OtlpExportPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: "service.name",
                value: { stringValue: this._serviceName },
              },
              {
                key: "service.version",
                value: { stringValue: this._serviceVersion },
              },
              {
                key: "telemetry.sdk.name",
                value: { stringValue: "glorian-otlp-core" },
              },
              {
                key: "telemetry.sdk.language",
                value: { stringValue: "typescript" },
              },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: "eos.core.tracer",
                version: this._serviceVersion,
              },
              spans: wireSpans.map((ws, i) => {
                const raw = this._spans[i];
                return {
                  ...ws,
                  kind: kindMap[raw.kind] || 1,
                  status: {
                    code: statusMap[raw.status.code] ?? 0,
                    ...(raw.status.description ? { message: raw.status.description } : {}),
                  },
                };
              }),
            },
          ],
        },
      ],
    };

    const serializedJson = JSON.stringify(payload);
    const receipt = pureSha256(`OTLP_TRACE_EXPORT:${timestamp}:${wireSpans.length}:${serializedJson}`);

    return deepFreeze({
      timestamp,
      spansExported: wireSpans.length,
      overflowCount: this._overflowCount,
      payload,
      serializedJson,
      receipt,
    });
  }

  /**
   * Clears accumulated spans.
   */
  public clear(): void {
    this._spans.length = 0;
    this._overflowCount = 0;
  }

  public get stats(): {
    bufferedSpans: number;
    maxCapacity: number;
    overflowCount: number;
  } {
    return deepFreeze({
      bufferedSpans: this._spans.length,
      maxCapacity: this._maxCapacity,
      overflowCount: this._overflowCount,
    });
  }

  private toWireSpan(span: SpanData): OtlpSpanWire {
    const attributes: OtlpKeyValue[] = Object.entries(span.attributes).map(([key, val]) => {
      const kv: OtlpKeyValue = { key, value: {} };
      if (typeof val === "string") {
        kv.value.stringValue = val;
      } else if (typeof val === "number") {
        if (Number.isInteger(val)) {
          kv.value.intValue = val.toString();
        } else {
          kv.value.doubleValue = val;
        }
      } else if (typeof val === "boolean") {
        kv.value.boolValue = val;
      }
      return kv;
    });

    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: 1,
      startTimeUnixNano: span.startTimeUnixNano,
      endTimeUnixNano: span.endTimeUnixNano,
      attributes,
      events: span.events.map((e) => ({
        timeUnixNano: e.timeUnixNano,
        name: e.name,
        attributes: e.attributes
          ? Object.entries(e.attributes).map(([k, v]) => ({
              key: k,
              value:
                typeof v === "string"
                  ? { stringValue: v }
                  : typeof v === "boolean"
                    ? { boolValue: v }
                    : { intValue: String(v) },
            }))
          : undefined,
      })),
      status: {
        code: 0,
      },
    };
  }
}
