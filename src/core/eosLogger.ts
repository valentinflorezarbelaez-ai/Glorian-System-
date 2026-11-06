/**
 * EOS STRUCTURED LOGGER (Layer 0)
 * SPEC-048: 10/10 Observability — Zero-dependency production JSON logger.
 *
 * Design:
 *  - Every log line is valid JSON to stderr (never pollutes MCP JSON-RPC stdout)
 *  - Log levels: SILENT < ERROR < WARN < INFO < DEBUG < TRACE
 *  - Sensitive field automatic redaction (apiKey, password, secret, token, etc.)
 *  - Nanosecond-precision timing helpers (.time / .timeEnd)
 *  - Namespace/child loggers for per-module context
 *  - Level controlled by EOS_LOG_LEVEL env var
 *
 * Zero external runtime dependencies.
 */

export type LogLevel = "SILENT" | "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

const LEVEL_NUM: Record<LogLevel, number> = {
  SILENT: 0,
  ERROR:  1,
  WARN:   2,
  INFO:   3,
  DEBUG:  4,
  TRACE:  5,
};

/** Fields that will be replaced with "[REDACTED]" in log output. */
const SENSITIVE_KEYS = new Set([
  "apiKey", "api_key", "password", "passwd", "secret",
  "token", "authorization", "auth", "credential",
  "private_key", "privateKey", "bearerToken",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactSensitive(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function resolveDefaultLevel(): LogLevel {
  const env = (process.env["EOS_LOG_LEVEL"] ?? "").toUpperCase() as LogLevel;
  if (env in LEVEL_NUM) return env;
  return process.env["NODE_ENV"] === "production" ? "INFO" : "DEBUG";
}

// ---------------------------------------------------------------------------
// EosLogger
// ---------------------------------------------------------------------------

/**
 * Zero-dependency structured JSON logger.
 *
 * @example
 * ```ts
 * const log = createLogger("eosAgiCore");
 * log.info("Solve started", { objective, branches: branches.length });
 * log.time("tribunal");
 * // ... run tribunal ...
 * log.timeEnd("tribunal", "Branch evaluated");
 * log.error("All branches failed", { newAxioms });
 * ```
 */
export class EosLogger {
  private readonly namespace: string;
  private readonly minLevel: number;
  private readonly timers = new Map<string, bigint>();

  constructor(namespace: string, level?: LogLevel) {
    this.namespace = namespace;
    this.minLevel = LEVEL_NUM[level ?? resolveDefaultLevel()];
  }

  /** Factory — creates a named logger. */
  static create(namespace: string, level?: LogLevel): EosLogger {
    return new EosLogger(namespace, level);
  }

  private _emit(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_NUM[level] > this.minLevel) return;

    const entry: Record<string, unknown> = {
      ts:    new Date().toISOString(),
      level,
      ns:    this.namespace,
      msg,
    };

    if (data && Object.keys(data).length > 0) {
      entry["data"] = redactSensitive(data);
    }

    // Write to stderr — never pollutes MCP JSON-RPC stdout
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  /** Logs a critical error — always visible unless SILENT. */
  error(msg: string, data?: Record<string, unknown>): void {
    this._emit("ERROR", msg, data);
  }

  /** Logs a warning. */
  warn(msg: string, data?: Record<string, unknown>): void {
    this._emit("WARN", msg, data);
  }

  /** Logs a standard operational event. */
  info(msg: string, data?: Record<string, unknown>): void {
    this._emit("INFO", msg, data);
  }

  /** Logs a debug-level diagnostic. */
  debug(msg: string, data?: Record<string, unknown>): void {
    this._emit("DEBUG", msg, data);
  }

  /** Logs fine-grained trace data. */
  trace(msg: string, data?: Record<string, unknown>): void {
    this._emit("TRACE", msg, data);
  }

  /**
   * Starts a named timer using `process.hrtime.bigint()`.
   * Call `.timeEnd(label)` to stop and log elapsed time.
   */
  time(label: string): void {
    this.timers.set(label, process.hrtime.bigint());
  }

  /**
   * Stops the named timer and logs elapsed milliseconds.
   * @returns Elapsed time in milliseconds.
   */
  timeEnd(label: string, msg?: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;
    this.timers.delete(label);
    const elapsedMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    this._emit("DEBUG", msg ?? label, { elapsedMs, timerLabel: label });
    return elapsedMs;
  }

  /**
   * Creates a child logger with a sub-namespace.
   * @example `log.child("tribunal")` → namespace becomes `eosAgiCore:tribunal`
   */
  child(subNamespace: string, level?: LogLevel): EosLogger {
    return new EosLogger(`${this.namespace}:${subNamespace}`, level);
  }
}

// ---------------------------------------------------------------------------
// Singleton root logger + factory
// ---------------------------------------------------------------------------

/** Root logger for top-level EOS operations. */
export const logger = EosLogger.create("eos");

/**
 * Factory for creating per-module child loggers.
 * @example `const log = createLogger("eosTurboEngine");`
 */
export function createLogger(namespace: string, level?: LogLevel): EosLogger {
  return EosLogger.create(namespace, level);
}
