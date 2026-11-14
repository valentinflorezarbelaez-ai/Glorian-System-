export type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";
export type SpanStatusCode = "UNSET" | "OK" | "ERROR";

export type SpanAttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];

export type SpanAttributes = Record<string, SpanAttributeValue>;

export interface SpanEvent {
  readonly name: string;
  readonly timeUnixNano: string;
  readonly attributes?: SpanAttributes;
}

export interface SpanLink {
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes?: SpanAttributes;
}

export interface SpanStatus {
  readonly code: SpanStatusCode;
  readonly message?: string;
}

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
  readonly traceState?: string;
}

export interface OtelSpanData {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly durationMs: number;
  readonly status: SpanStatus;
  readonly attributes: SpanAttributes;
  readonly events: readonly SpanEvent[];
  readonly links?: readonly SpanLink[];
}

export interface TraceWaterfallItem {
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly durationMs: number;
  readonly offsetMs: number;
  readonly offsetPercent: number;
  readonly widthPercent: number;
  readonly depth: number;
  readonly status: SpanStatusCode;
  readonly isBottleneck: boolean;
}

export interface TraceWaterfallReport {
  readonly traceId: string;
  readonly rootSpanName: string;
  readonly totalDurationMs: number;
  readonly spanCount: number;
  readonly bottleneckSpanId: string;
  readonly bottleneckDurationMs: number;
  readonly spans: readonly TraceWaterfallItem[];
}

export interface OtlpExportPayload {
  readonly resourceSpans: Array<{
    readonly resource: {
      readonly attributes: Array<{
        readonly key: string;
        readonly value: { readonly stringValue?: string; readonly intValue?: number; readonly boolValue?: boolean };
      }>;
    };
    readonly scopeSpans: Array<{
      readonly scope: { readonly name: string; readonly version: string };
      readonly spans: Array<{
        readonly traceId: string;
        readonly spanId: string;
        readonly parentSpanId?: string;
        readonly name: string;
        readonly kind: number;
        readonly startTimeUnixNano: string;
        readonly endTimeUnixNano: string;
        readonly attributes: Array<{
          readonly key: string;
          readonly value: { readonly stringValue?: string; readonly intValue?: number; readonly boolValue?: boolean };
        }>;
        readonly events: Array<{
          readonly timeUnixNano: string;
          readonly name: string;
          readonly attributes?: Array<{
            readonly key: string;
            readonly value: { readonly stringValue?: string; readonly intValue?: number; readonly boolValue?: boolean };
          }>;
        }>;
        readonly status: { readonly code: number; readonly message?: string };
      }>;
    }>;
  }>;
}
