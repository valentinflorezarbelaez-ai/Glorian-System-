/**
 * SPEC-226 / CHANGE-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine
 * Type definitions for W3C TraceContext and OpenTelemetry OTLP/HTTP-JSON v1/traces.
 */

export type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";

export type StatusCode = "UNSET" | "OK" | "ERROR";

export interface W3CTraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: string;
  readonly traceState?: string;
}

export type SpanAttributeValue = string | number | boolean;

export interface SpanStatus {
  readonly code: StatusCode;
  readonly description?: string;
}

export interface SpanEvent {
  readonly name: string;
  readonly timeUnixNano: string;
  readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
}

export interface SpanData {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attributes: Readonly<Record<string, SpanAttributeValue>>;
  readonly events: readonly SpanEvent[];
  readonly status: SpanStatus;
}

export interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAttributeValue;
}

export interface OtlpEventWire {
  timeUnixNano: string;
  name: string;
  attributes?: OtlpKeyValue[];
}

export interface OtlpSpanWire {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  events: OtlpEventWire[];
  status: {
    code: number;
    message?: string;
  };
}

export interface OtlpScopeSpans {
  scope: {
    name: string;
    version: string;
  };
  spans: OtlpSpanWire[];
}

export interface OtlpResourceSpans {
  resource: {
    attributes: OtlpKeyValue[];
  };
  scopeSpans: OtlpScopeSpans[];
}

export interface OtlpExportPayload {
  resourceSpans: OtlpResourceSpans[];
}

export interface OtlpTraceExportReport {
  readonly timestamp: number;
  readonly spansExported: number;
  readonly overflowCount: number;
  readonly payload: OtlpExportPayload;
  readonly serializedJson: string;
  readonly receipt: string;
}

export interface TracerConfig {
  readonly serviceName?: string;
  readonly serviceVersion?: string;
  readonly maxCapacity?: number;
}
