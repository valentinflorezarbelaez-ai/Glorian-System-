/**
 * EOS SYSTEM — MODEL CONTEXT PROTOCOL (MCP) STREAMABLE HTTP SERVER (Layer 0)
 * Governed by SPEC-027, SPEC-140, CHANGE-075, ADR-0172, ADR-0173
 *
 * v62.0 — Clean rewrite removing merge artifact:
 *   - Single, unified constructor (no phantom `options` parameter)
 *   - Single, unified auth check (no duplicate Bearer comparison)
 *   - Single body-size cap (no duplicate `contentLength` declaration)
 *   - All constants defined inline (no undefined DEFAULT_* references)
 *   - `writeJson` helper defined as a private method
 *   - `StreamableSession` phantom type removed; `close()` takes no arguments
 *   - SUPPORTED_MCP_PROTOCOL_VERSIONS defined as a frozen Set
 *   - All v61 improvements preserved: SSE per-IP rate limit, request dedup,
 *     async dispatch, prompts/list, resources/list, idle session 60 min,
 *     dynamic version from package.json
 *
 * Invariant: 100% Layer-0 purity with zero external npm runtime dependencies.
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { EosMcpServer, type JsonRpcRequest, type JsonRpcResponse } from "./eosMcpServer.ts";
import { EosPrometheusExporter } from "../core/eosPrometheusExporter.ts";

// ── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_MAX_SESSIONS = 500;
const DEFAULT_MAX_REQUEST_BYTES = 1 * 1024 * 1024; // 1 MB
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;          // 30 s
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;       // 15 s
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;             // 60 min

/** MCP spec versions this server supports. */
const SUPPORTED_MCP_PROTOCOL_VERSIONS = Object.freeze(
  new Set(["2025-06-18", "2025-03-26", "2024-11-05"])
);

// ── Dynamic version from package.json (not hardcoded) ─────────────────────
let _serverVersion = "62.0.0";
try {
  const _dir = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(_dir, "../../package.json"), "utf8")
  );
  _serverVersion = (pkg as { version?: string }).version ?? _serverVersion;
} catch { /* keep default */ }

// ── Built-in prompts for Antigravity/Gemini discovery ─────────────────────
const EOS_PROMPTS = Object.freeze([
  {
    name: "eos-consult",
    description:
      "Get a world-class engineering consulting deliverable (5-Whys, ADR, code, risk matrix, FinOps estimate) for any problem — offline, no API key needed.",
    arguments: [
      { name: "problem", description: "Describe the engineering problem, bug, or architecture question", required: true },
    ],
  },
  {
    name: "eos-pipeline",
    description:
      "Run the AGI end-to-end pipeline: context assembly → model router → Tree of Thoughts → deterministic tribunal. Returns verified code or crystallized axioms.",
    arguments: [
      { name: "problem", description: "Natural language problem description", required: true },
      { name: "targetFile", description: "Relative path to the primary file to fix", required: true },
      { name: "testCommand", description: "Test command used as tribunal (exit 0 = law)", required: true },
    ],
  },
  {
    name: "eos-drift",
    description:
      "Detect spec drift — find modules that were modified without updating their formal specification.",
    arguments: [
      { name: "daysThreshold", description: "Days of drift before flagging (default: 7)", required: false },
    ],
  },
  {
    name: "eos-context",
    description:
      "Assemble a token-budget-aware context block for a target file using semantic blast radius analysis.",
    arguments: [
      { name: "objective", description: "What do you need to do with the file", required: true },
      { name: "targetFile", description: "Relative path to the file", required: true },
      { name: "tokenBudget", description: "Max tokens (default: 32000)", required: false },
    ],
  },
]);

// ── Built-in resources for Antigravity/Gemini discovery ───────────────────
const EOS_RESOURCES = Object.freeze([
  {
    uri: "eos://specs/constitution",
    name: "EOS Constitution",
    description: "The 7 Inviolable Laws and EARS/BDD specification standards governing EOS System",
    mimeType: "text/markdown",
  },
  {
    uri: "eos://evidence/receipt",
    name: "Last CI/CD Receipt",
    description: "Cryptographically sealed SBOM receipt from the last successful CI/CD run",
    mimeType: "application/json",
  },
  {
    uri: "eos://projects/registry",
    name: "Fleet Registry",
    description: "Registered fleet projects with local paths, remote URLs, and production endpoints",
    mimeType: "application/json",
  },
  {
    uri: "eos://memory/axioms",
    name: "AGI Axiom Memory",
    description: "Crystallized rules learned from past failed AGI branches — inject into prompts to prevent repeat errors",
    mimeType: "application/json",
  },
  {
    uri: "eos://openapi",
    name: "EOS OpenAPI Spec",
    description: "OpenAPI 3.1 specification for all 14 serverless API endpoints",
    mimeType: "application/yaml",
  },
]);

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProgressNotificationParams {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

export interface EosMcpStreamServerOptions {
  authToken?: string;
  allowedOrigins?: string[];
  maxSessions?: number;
  maxRequestBytes?: number;
  requestTimeoutMs?: number;
  heartbeatIntervalMs?: number;
}

// ============================================================================
// EosMcpSession
// ============================================================================

export class EosMcpSession {
  public readonly id: string;
  public readonly createdAt: number;
  public lastActivity: number;
  private readonly res: http.ServerResponse;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(id: string, res: http.ServerResponse, heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS) {
    this.id = id;
    this.res = res;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    if (heartbeatIntervalMs > 0) {
      this.keepAliveTimer = setInterval(() => this.sendHeartbeat(), heartbeatIntervalMs);
      (this.keepAliveTimer as NodeJS.Timeout).unref();
    }
    this._resetIdleTimer();
  }

  private _resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), IDLE_TIMEOUT_MS);
    this.idleTimer.unref();
  }

  public sendEvent(event: string, data: unknown): boolean {
    if (this.closed || this.res.writableEnded || !this.res.writable) return false;
    this.lastActivity = Date.now();
    this._resetIdleTimer();
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    const frame = `event: ${event}\ndata: ${payload}\n\n`;
    try {
      this.res.write(frame);
      return true;
    } catch {
      this.close();
      return false;
    }
  }

  public sendHeartbeat(): void {
    if (this.closed || this.res.writableEnded || !this.res.writable) return;
    try { this.res.write(": keep-alive\n\n"); } catch { this.close(); }
  }

  public sendProgress(token: string | number, progress: number, total?: number, message?: string): boolean {
    const notification: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: { progressToken: token, progress, total, message },
    };
    return this.sendEvent("message", notification);
  }

  public isAlive(): boolean {
    return !this.closed && !this.res.writableEnded && this.res.writable;
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (!this.res.writableEnded && this.res.writable) {
      try { this.res.end(); } catch { /* silent on abrupt termination */ }
    }
  }
}

// ============================================================================
// EosMcpSessionManager
// ============================================================================

export class EosMcpSessionManager {
  private readonly sessions = new Map<string, EosMcpSession>();
  private readonly heartbeatIntervalMs: number;
  private readonly maxSessions: number;
  private readonly gcTimer: NodeJS.Timeout;

  /** Per-IP SSE rate limiting — max 10 concurrent sessions per IP. */
  private readonly sessionsPerIp = new Map<string, number>();
  private static readonly MAX_SESSIONS_PER_IP = 10;

  constructor(heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS, maxSessions = DEFAULT_MAX_SESSIONS) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.maxSessions = maxSessions;
    this.gcTimer = setInterval(() => this._gc(), 5 * 60 * 1000).unref();
  }

  private _gc(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (!session.isAlive()) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Creates a new session. Returns null if the per-IP or global cap is exceeded.
   */
  public createSession(res: http.ServerResponse, clientIp = "unknown"): EosMcpSession | null {
    // Global cap — evict oldest if full
    if (this.sessions.size >= this.maxSessions) {
      const oldest = [...this.sessions.entries()].sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      )[0];
      if (oldest) {
        oldest[1].close();
        this.sessions.delete(oldest[0]);
      }
    }

    // Per-IP cap — prevents a single client from exhausting all sessions
    const ipCount = this.sessionsPerIp.get(clientIp) ?? 0;
    if (ipCount >= EosMcpSessionManager.MAX_SESSIONS_PER_IP) {
      return null; // caller should respond 429
    }

    const sessionId = crypto.randomUUID();
    const session = new EosMcpSession(sessionId, res, this.heartbeatIntervalMs);
    this.sessions.set(sessionId, session);
    this.sessionsPerIp.set(clientIp, ipCount + 1);

    // Track removal so per-IP counter decrements when the connection closes
    const onClose = (): void => {
      this.sessions.delete(sessionId);
      const current = this.sessionsPerIp.get(clientIp) ?? 1;
      if (current <= 1) this.sessionsPerIp.delete(clientIp);
      else this.sessionsPerIp.set(clientIp, current - 1);
    };
    (res as NodeJS.EventEmitter).once("close", onClose);
    (res as NodeJS.EventEmitter).once("finish", onClose);

    return session;
  }

  public getSession(sessionId: string): EosMcpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && !session.isAlive()) {
      this.removeSession(sessionId);
      return undefined;
    }
    return session;
  }

  public removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  public getActiveSessions(): Array<{ id: string; createdAt: number; ageMs: number }> {
    const now = Date.now();
    const list: Array<{ id: string; createdAt: number; ageMs: number }> = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.isAlive()) {
        list.push({ id, createdAt: session.createdAt, ageMs: now - session.createdAt });
      } else {
        this.sessions.delete(id);
      }
    }
    return list;
  }

  public closeAll(): void {
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
    this.sessionsPerIp.clear();
    clearInterval(this.gcTimer);
  }
}

// ============================================================================
// EosMcpStreamServer
// ============================================================================

export class EosMcpStreamServer {
  public readonly mcpServer: EosMcpServer;
  public readonly sessionManager: EosMcpSessionManager;
  public readonly authToken: string;

  private server: http.Server | null = null;
  private readonly projectRoot: string;
  private readonly allowedOrigins: Set<string>;
  private readonly maxRequestBytes: number;
  private readonly requestTimeoutMs: number;

  /**
   * Per-IP token-bucket rate limiter for POST /message (Stripe/Anthropic standard).
   * 60 requests/min burst per IP — prevents a single client from flooding the dispatch queue.
   * Each bucket refills at 1 token/sec (60/min steady state).
   */
  private readonly _messageBuckets = new Map<string, { tokens: number; lastRefill: number }>();
  private static readonly _MSG_CAPACITY = 60;
  private static readonly _MSG_REFILL_PER_SEC = 1;

  private _consumeMessageToken(clientIp: string): boolean {
    const now = Date.now();
    let bucket = this._messageBuckets.get(clientIp);
    if (!bucket) {
      bucket = { tokens: EosMcpStreamServer._MSG_CAPACITY, lastRefill: now };
      this._messageBuckets.set(clientIp, bucket);
    }
    // Refill based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      EosMcpStreamServer._MSG_CAPACITY,
      bucket.tokens + elapsed * EosMcpStreamServer._MSG_REFILL_PER_SEC
    );
    bucket.lastRefill = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** In-flight request IDs for deduplication (prevents double-dispatch on network retry). */
  private readonly inFlight = new Set<string>();

  constructor(projectRoot?: string, options: EosMcpStreamServerOptions = {}) {
    this.projectRoot = projectRoot ?? process.cwd();
    this.mcpServer = new EosMcpServer(this.projectRoot);

    const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (!Number.isInteger(maxSessions) || maxSessions < 1) {
      throw new Error("maxSessions must be a positive integer.");
    }
    if (!Number.isInteger(this.maxRequestBytes) || this.maxRequestBytes < 1) {
      throw new Error("maxRequestBytes must be a positive integer.");
    }
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 1) {
      throw new Error("requestTimeoutMs must be a positive integer.");
    }

    this.sessionManager = new EosMcpSessionManager(heartbeatIntervalMs, maxSessions);

    // ── Auth token setup ─────────────────────────────────────────────────
    const configuredToken = options.authToken ?? process.env["EOS_MCP_HTTP_TOKEN"];
    if (configuredToken !== undefined && Buffer.byteLength(configuredToken, "utf8") < 32) {
      throw new Error("EOS MCP HTTP bearer tokens must contain at least 32 bytes.");
    }
    this.authToken = configuredToken ?? crypto.randomBytes(32).toString("base64url");

    // ── Allowed origins validation ───────────────────────────────────────
    const originValues =
      options.allowedOrigins ??
      (process.env["EOS_MCP_ALLOWED_ORIGINS"] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    this.allowedOrigins = new Set(
      originValues.map((origin) => {
        let parsed: URL;
        try { parsed = new URL(origin); } catch {
          throw new Error(`Invalid EOS MCP allowed origin: ${origin}`);
        }
        if (
          (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
          parsed.origin !== origin ||
          origin === "*"
        ) {
          throw new Error(
            `EOS MCP allowed origins must be exact HTTP(S) origins without paths: ${origin}`
          );
        }
        return origin;
      })
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private writeJson(
    res: http.ServerResponse,
    status: number,
    body: unknown,
    extraHeaders: Record<string, string> = {}
  ): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...extraHeaders,
    });
    res.end(payload);
  }

  private _authenticate(req: http.IncomingMessage): boolean {
    // Constant-time Bearer token comparison (prevents timing attacks)
    const authorization = req.headers["authorization"] ?? "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const suppliedBuf = Buffer.from(suppliedToken, "utf8");
    const expectedBuf = Buffer.from(this.authToken, "utf8");
    return (
      suppliedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(suppliedBuf, expectedBuf)
    );
  }

  // ── Main request handler ──────────────────────────────────────────────────

  /**
   * Main HTTP request router implementing the MCP 2024-11-05 spec.
   * Optimized for Antigravity (prompts/resources), Cursor, and Claude Code.
   */
  /**
   * Resolves the correct `Access-Control-Allow-Origin` value for a given request:
   * - If `this.allowedOrigins` has entries, only exact-match origins are reflected.
   * - If empty (no allowlist configured), dev defaults to `*`; production to `"null"`.
   */
  private _getCorsOrigin(req: http.IncomingMessage): string {
    const requestOrigin = (req.headers["origin"] ?? "") as string;
    if (this.allowedOrigins.size > 0) {
      // Strict allowlist — only reflect known origins (Google/Stripe standard)
      return this.allowedOrigins.has(requestOrigin) ? requestOrigin : "null";
    }
    // No allowlist — permissive in dev, locked down in production
    return process.env["NODE_ENV"] === "production" ? "null" : "*";
  }

  public async handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // ── CORS (enforces this.allowedOrigins allowlist when configured) ────────
    const allowedOrigin = this._getCorsOrigin(req);
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id, mcp-protocol-version");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── Parse URL ───────────────────────────────────────────────────────────
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    } catch {
      this.writeJson(res, 400, { error: "Invalid request URL." });
      return;
    }
    const pathname = parsedUrl.pathname;

    // ── Health / status (no auth required) ─────────────────────────────────
    if (pathname === "/health" || pathname === "/status") {
      this.writeJson(res, 200, {
        status: "UP",
        server: "eos-system-mcp-stream",
        version: _serverVersion,
        protocolVersion: "2024-11-05",
        activeSessions: this.sessionManager.getActiveSessions().length,
        uptimeSeconds: Math.floor(process.uptime()),
        transports: ["stdio", "sse", "http-jsonrpc"],
      });
      return;
    }

    // ── DNS Rebinding guard ─────────────────────────────────────────────────
    const hostHeader = (req.headers["host"] ?? "").toLowerCase();
    if (hostHeader.includes("@") || hostHeader.includes("..")) {
      this.writeJson(res, 403, { error: "Invalid Host header format." });
      req.resume();
      return;
    }

    // ── Single auth check (constant-time) ───────────────────────────────────
    if (!this._authenticate(req)) {
      this.writeJson(res, 401, { error: "Unauthorized." }, { "WWW-Authenticate": "Bearer" });
      req.resume();
      return;
    }

    // ── MCP-Protocol-Version validation ─────────────────────────────────────
    const protocolVersionHeader = (
      req.headers["mcp-protocol-version"] ?? req.headers["x-mcp-protocol-version"]
    ) as string | undefined;
    if (protocolVersionHeader && !SUPPORTED_MCP_PROTOCOL_VERSIONS.has(protocolVersionHeader)) {
      this.writeJson(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: `Unsupported MCP-Protocol-Version: '${protocolVersionHeader}'. Supported: ${[...SUPPORTED_MCP_PROTOCOL_VERSIONS].join(", ")}`,
        },
      });
      req.resume();
      return;
    }

    // ── /metrics ─────────────────────────────────────────────────────────────
    if (req.method === "GET" && pathname === "/metrics") {
      const exporter = new EosPrometheusExporter(this.projectRoot);
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(exporter.formatPrometheusText());
      return;
    }

    // ── /sse — rate-limited SSE endpoint ─────────────────────────────────────
    if (req.method === "GET" && (pathname === "/sse" || pathname === "/events")) {
      const clientIp =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        req.socket.remoteAddress ??
        "unknown";

      const session = this.sessionManager.createSession(res, clientIp);
      if (!session) {
        // Per-IP cap exceeded — must write SSE headers first, then signal error
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        });
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: 429, message: "Too many SSE connections from this IP" })}\n\n`
        );
        res.end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders?.();

      session.sendEvent("endpoint", `/message?sessionId=${session.id}`);
      req.on("close", () => this.sessionManager.removeSession(session.id));
      return;
    }

    // ── /message — async, deduplicated, rate-limited JSON-RPC dispatch ──────
    if (req.method === "POST" && pathname === "/message") {
      // Per-IP rate limit (Stripe/Anthropic: all mutation endpoints rate-limited)
      const msgClientIp =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
        req.socket.remoteAddress ??
        "unknown";
      if (!this._consumeMessageToken(msgClientIp)) {
        this.writeJson(res, 429, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Rate limit exceeded. Retry after 1 second." },
        }, { "Retry-After": "1", "X-RateLimit-Limit": String(EosMcpStreamServer._MSG_CAPACITY) });
        req.resume();
        return;
      }

      const sessionId =
        parsedUrl.searchParams.get("sessionId") ??
        (req.headers["x-session-id"] as string | undefined);
      const session = sessionId ? this.sessionManager.getSession(sessionId) : undefined;
      if (!session) {
        this.writeJson(res, 404, { error: "MCP session not found." });
        req.resume();
        return;
      }

      const contentType = req.headers["content-type"] ?? "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        this.writeJson(res, 415, { error: "Content-Type must be application/json." });
        req.resume();
        return;
      }

      // Single body-size cap (CVE-1: DoS via unbounded body)
      const declaredLength = Number(req.headers["content-length"] ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > this.maxRequestBytes) {
        this.writeJson(res, 413, { error: "Request body exceeds the configured size limit." });
        req.resume();
        return;
      }

      let body = "";
      let bytesReceived = 0;

      req.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
        if (bytesReceived > this.maxRequestBytes) {
          req.socket.destroy();
          if (!res.writableEnded) {
            this.writeJson(res, 413, {
              error: "Payload Too Large",
              code: "EOS_BODY_TOO_LARGE",
              maxBytes: this.maxRequestBytes,
            });
          }
          return;
        }
        body += chunk.toString("utf8");
      });

      req.on("end", async () => {
        try {
          if (!body.trim()) {
            this.writeJson(res, 400, {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "Empty request body" },
            });
            return;
          }

          let jsonRpcReq: JsonRpcRequest;
          try {
            jsonRpcReq = JSON.parse(body) as JsonRpcRequest;
          } catch (parseErr) {
            this.writeJson(res, 400, {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32700, message: "Parse error: Invalid JSON", data: String(parseErr) },
            });
            return;
          }

          // ── Request deduplication ───────────────────────────────────────
          // Antigravity and some clients retry on network timeout — same request
          // ID arriving twice would dispatch the same tool twice (dangerous for
          // mutations).
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
            const dedupKey = `${sessionId ?? "global"}:${jsonRpcReq.id}`;
            if (this.inFlight.has(dedupKey)) {
              this.writeJson(res, 202, {
                jsonrpc: "2.0",
                id: jsonRpcReq.id,
                result: { status: "DUPLICATE_IN_FLIGHT" },
              });
              return;
            }
            this.inFlight.add(dedupKey);
            // Auto-clean after 30s regardless of completion
            setTimeout(() => this.inFlight.delete(dedupKey), 30_000).unref();
          }

          const progressCallback = (progress: number, total?: number, msg?: string): void => {
            if (session && jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
              session.sendProgress(jsonRpcReq.id!, progress, total, msg);
            }
          };

          // ── Fully async dispatch ────────────────────────────────────────
          const response = await this.dispatchJsonRpc(jsonRpcReq, progressCallback);

          // Clean up dedup key on completion
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
            this.inFlight.delete(`${sessionId ?? "global"}:${jsonRpcReq.id}`);
          }

          if (session && response) session.sendEvent("message", response);
          if (!res.writableEnded) {
            this.writeJson(res, 200, response ?? {});
          }
        } catch (err: unknown) {
          const errorRes: JsonRpcResponse = {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: "Internal server error",
              ...(process.env["NODE_ENV"] !== "production" && {
                data: String((err as Error)?.message ?? err),
              }),
            },
          };
          if (!res.writableEnded) {
            this.writeJson(res, 500, errorRes);
          }
        }
      });
      return;
    }

    // ── /prompts — Antigravity prompt discovery ───────────────────────────────
    if (req.method === "GET" && pathname === "/prompts") {
      this.writeJson(res, 200, { prompts: EOS_PROMPTS });
      return;
    }

    // ── /resources — Antigravity resource discovery ───────────────────────────
    if (req.method === "GET" && pathname === "/resources") {
      this.writeJson(res, 200, { resources: EOS_RESOURCES });
      return;
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    this.writeJson(res, 404, { error: `Not found: ${pathname}` });
  }

  /** Dispatches JSON-RPC request to EosMcpServer. Wrapped in Promise for future async tool support. */
  public dispatchJsonRpc(
    req: JsonRpcRequest,
    onProgress?: (progress: number, total?: number, message?: string) => void
  ): Promise<JsonRpcResponse | null> {
    return Promise.resolve(this.mcpServer.handleRequest(req, onProgress));
  }

  /** Starts the HTTP server. */
  public listen(port = 3333, host = "127.0.0.1"): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch((err: unknown) => {
          if (!res.writableEnded) {
            this.writeJson(res, 500, { error: (err as Error).message });
          }
        });
      });
      this.server.on("error", reject);
      this.server.listen(port, host, () => resolve(this.server!));
    });
  }

  /** Gracefully closes the server and all active sessions. */
  public close(): Promise<void> {
    this.sessionManager.closeAll();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }
}
