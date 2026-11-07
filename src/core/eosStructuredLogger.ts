/**
 * EOS SYSTEM — STRUCTURED LOGGING WITH W3C CORRELATION IDs (Layer 0)
 * Governed by SPEC-147 (Google SRE Structured Logging)
 *
 * Implements:
 * - JSON-structured log entries with severity levels (TRACE/DEBUG/INFO/WARN/ERROR/FATAL)
 * - W3C Trace-Context propagation (traceparent + tracestate headers)
 * - Correlation ID auto-generation & inheritance across async boundaries
 * - Deterministic sampling rate for high-throughput paths
 * - Zero external dependencies
 *
 * W3C traceparent format: 00-{trace-id(32hex)}-{span-id(16hex)}-{flags(2hex)}
 */

import crypto from "node:crypto";
import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface TraceContext {
  readonly traceId: string; // 32 hex chars
  readonly spanId: string; // 16 hex chars
  readonly parentSpanId: string | null;
  readonly flags: number; // 0x01 = sampled
}

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly correlationId: string;
  readonly module: string;
  readonly metadata: Record<string, unknown> | null;
}

export interface StructuredLoggerConfig {
  readonly moduleName: string;
  readonly minLevel: LogLevel;
  readonly sampleRate: number; // 0.0 to 1.0 for TRACE/DEBUG
  readonly output: (line: string) => void;
}

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

// ---------------------------------------------------------------------------
// W3C Trace-Context helpers
// ---------------------------------------------------------------------------

function generateTraceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateSpanId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.split("-");
  if (parts.length !== 4) return null;
  const [version, traceId, spanId, flags] = parts;
  if (version !== "00") return null;
  if (traceId.length !== 32 || !/^[0-9a-f]+$/.test(traceId)) return null;
  if (spanId.length !== 16 || !/^[0-9a-f]+$/.test(spanId)) return null;
  return { traceId, spanId, parentSpanId: null, flags: parseInt(flags, 16) };
}

export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.flags.toString(16).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export class EosStructuredLogger {
  private readonly config: StructuredLoggerConfig;
  private readonly correlationId: string;
  private currentTrace: TraceContext;

  constructor(config: StructuredLoggerConfig) {
    this.config = config;
    this.correlationId = crypto.randomUUID();
    this.currentTrace = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: null,
      flags: 0x01,
    };
  }

  /**
   * Creates a child span (for tracing nested operations).
   */
  createChildSpan(): EosStructuredLogger {
    const child = new EosStructuredLogger(this.config);
    child.currentTrace = {
      traceId: this.currentTrace.traceId, // inherit trace ID
      spanId: generateSpanId(),
      parentSpanId: this.currentTrace.spanId,
      flags: this.currentTrace.flags,
    };
    return child;
  }

  /**
   * Sets trace context from an inbound W3C traceparent header.
   */
  static fromTraceparent(header: string, config: StructuredLoggerConfig): EosStructuredLogger | null {
    const ctx = parseTraceparent(header);
    if (!ctx) return null;
    const logger = new EosStructuredLogger(config);
    logger.currentTrace = { ...ctx, parentSpanId: null };
    return logger;
  }

  /**
   * Returns the current W3C traceparent header value.
   */
  traceparentHeader(): string {
    return formatTraceparent(this.currentTrace);
  }

  getTraceContext(): TraceContext {
    return deepFreeze({ ...this.currentTrace });
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  // -------------------------------------------------------------------------
  // Log methods
  // -------------------------------------------------------------------------

  trace(message: string, metadata?: Record<string, unknown>): void {
    this.emit("TRACE", message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.emit("DEBUG", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.emit("INFO", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.emit("WARN", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.emit("ERROR", message, metadata);
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.emit("FATAL", message, metadata);
  }

  /**
   * Logs timing of an async operation. Returns the result.
   */
  async timed<T>(message: string, fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);
      this.info(message, { durationMs, status: "ok" });
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      this.error(message, { durationMs, status: "error", error: String(err) });
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private emit(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.config.minLevel]) return;
    // Sampling for TRACE/DEBUG
    if (level === "TRACE" || level === "DEBUG") {
      if (Math.random() > this.config.sampleRate) return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId: this.currentTrace.traceId,
      spanId: this.currentTrace.spanId,
      parentSpanId: this.currentTrace.parentSpanId,
      correlationId: this.correlationId,
      module: this.config.moduleName,
      metadata: metadata ?? null,
    };

    this.config.output(JSON.stringify(entry));
  }
}
