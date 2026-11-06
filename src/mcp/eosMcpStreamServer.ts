/**
 * EOS SYSTEM — MODEL CONTEXT PROTOCOL (MCP) STREAMABLE HTTP SERVER (Layer 0)
 * Governed by SPEC-027, SPEC-140, CHANGE-075, ADR-0172, ADR-0173
 *
 * v61.0 — Optimizations for Antigravity, Cursor, and Claude Code:
 *   - Rate limiting on /sse endpoint (CVE-2 fix: was unbounded)
 *   - Request ID deduplication (prevents duplicate dispatch under network retry)
 *   - Fully async dispatch (non-blocking — long tools don't stall the event loop)
 *   - MCP prompts/list endpoint (Antigravity discovers built-in prompts)
 *   - MCP resources/list endpoint (Antigravity discovers project resources)
 *   - Version sync with package.json (was hardcoded "35.0.0")
 *   - Connection timeout on idle SSE sessions (60 min)
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

// ── Dynamic version from package.json (not hardcoded) ──────────────────────
let _serverVersion = "61.0.0";
try {
  const _dir = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.resolve(_dir, "../../package.json"), "utf8"));
  _serverVersion = pkg.version ?? _serverVersion;
} catch { /* keep default */ }

// ── Built-in prompts for Antigravity/Gemini discovery ──────────────────────
const EOS_PROMPTS = Object.freeze([
  {
    name: "eos-consult",
    description: "Get a world-class engineering consulting deliverable (5-Whys, ADR, code, risk matrix, FinOps estimate) for any problem — offline, no API key needed.",
    arguments: [{
      name: "problem", description: "Describe the engineering problem, bug, or architecture question", required: true,
    }],
  },
  {
    name: "eos-pipeline",
    description: "Run the AGI end-to-end pipeline: context assembly → model router → Tree of Thoughts → deterministic tribunal. Returns verified code or crystallized axioms.",
    arguments: [
      { name: "problem", description: "Natural language problem description", required: true },
      { name: "targetFile", description: "Relative path to the primary file to fix", required: true },
      { name: "testCommand", description: "Test command used as tribunal (exit 0 = law)", required: true },
    ],
  },
  {
    name: "eos-drift",
    description: "Detect spec drift — find modules that were modified without updating their formal specification.",
    arguments: [{
      name: "daysThreshold", description: "Days of drift before flagging (default: 7)", required: false,
    }],
  },
  {
    name: "eos-context",
    description: "Assemble a token-budget-aware context block for a target file using semantic blast radius analysis.",
    arguments: [
      { name: "objective", description: "What do you need to do with the file", required: true },
      { name: "targetFile", description: "Relative path to the file", required: true },
      { name: "tokenBudget", description: "Max tokens (default: 32000)", required: false },
    ],
  },
]);

// ── Built-in resources for Antigravity/Gemini discovery ────────────────────
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

export interface ProgressNotificationParams {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
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

  /** Maximum idle time before auto-closing session (60 minutes). */
  private static readonly IDLE_TIMEOUT_MS = 60 * 60 * 1000;

  constructor(id: string, res: http.ServerResponse, heartbeatIntervalMs = 15000) {
    this.id = id;
    this.res = res;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    if (heartbeatIntervalMs > 0) {
      this.keepAliveTimer = setInterval(() => this.sendHeartbeat(), heartbeatIntervalMs);
    }
    this._resetIdleTimer();
  }

  private _resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), EosMcpSession.IDLE_TIMEOUT_MS);
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
  private static readonly MAX_SESSIONS = 500;
  private readonly gcTimer: NodeJS.Timeout;

  /** Per-IP SSE rate limiting — max 10 concurrent sessions per IP. */
  private readonly sessionsPerIp = new Map<string, number>();
  private static readonly MAX_SESSIONS_PER_IP = 10;

  constructor(heartbeatIntervalMs = 15000) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.gcTimer = setInterval(() => this._gc(), 5 * 60 * 1000).unref();
  }

  private _gc(): void {
    for (const [id, session] of this.sessions.entries()) {
      if (!session.isAlive()) this._removeFromMaps(id, session);
    }
  }

  private _removeFromMaps(id: string, session: EosMcpSession): void {
    this.sessions.delete(id);
  }

  /**
   * Creates a new session. Returns null if the per-IP or global cap is exceeded.
   */
  public createSession(res: http.ServerResponse, clientIp = "unknown"): EosMcpSession | null {
    // Global cap
    if (this.sessions.size >= EosMcpSessionManager.MAX_SESSIONS) {
      const oldest = [...this.sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) { oldest[1].close(); this.sessions.delete(oldest[0]); }
    }

    // Per-IP cap — prevents single client from exhausting all sessions
    const ipCount = this.sessionsPerIp.get(clientIp) ?? 0;
    if (ipCount >= EosMcpSessionManager.MAX_SESSIONS_PER_IP) {
      return null; // caller should respond 429
    }

    const sessionId = crypto.randomUUID();
    const session = new EosMcpSession(sessionId, res, this.heartbeatIntervalMs);
    this.sessions.set(sessionId, session);
    this.sessionsPerIp.set(clientIp, ipCount + 1);

    return session;
  }

  public getSession(sessionId: string): EosMcpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && !session.isAlive()) { this.removeSession(sessionId); return undefined; }
    return session;
  }

  public removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) { session.close(); this.sessions.delete(sessionId); return true; }
    return false;
  }

  public getActiveSessions(): Array<{ id: string; createdAt: number; ageMs: number }> {
    const now = Date.now();
    const list: Array<{ id: string; createdAt: number; ageMs: number }> = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.isAlive()) list.push({ id, createdAt: session.createdAt, ageMs: now - session.createdAt });
      else this.sessions.delete(id);
    }
    return list;
  }

  public closeAll(): void {
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
    this.sessionsPerIp.clear();
  }
}

// ============================================================================
// EosMcpStreamServer
// ============================================================================

export class EosMcpStreamServer {
  public static readonly DEFAULT_IDLE_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
  public readonly mcpServer: EosMcpServer;
  public readonly sessionManager: EosMcpSessionManager;
  public readonly authToken: string;
  private server: http.Server | null = null;
  private readonly projectRoot: string;
  private readonly allowedOrigins: Set<string>;
  private readonly maxSessions: number;
  private readonly maxRequestBytes: number;
  private readonly requestTimeoutMs: number;
  private readonly heartbeatIntervalMs: number;
  private reaperInterval: NodeJS.Timeout | null = null;
  private readonly streamableSessions = new Map<string, StreamableSession>();

  /** In-flight request IDs for deduplication (prevents double-dispatch on network retry). */
  private readonly inFlight = new Set<string>();

  constructor(projectRoot?: string, heartbeatIntervalMs = 15000) {
    this.projectRoot = projectRoot || process.cwd();
    this.mcpServer = new EosMcpServer(this.projectRoot);
    this.sessionManager = new EosMcpSessionManager(heartbeatIntervalMs);
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    const configuredToken = options.authToken ?? process.env.EOS_MCP_HTTP_TOKEN;
    if (configuredToken !== undefined && Buffer.byteLength(configuredToken, "utf8") < 32) {
      throw new Error("EOS MCP HTTP bearer tokens must contain at least 32 bytes.");
    }
    this.authToken = configuredToken || crypto.randomBytes(32).toString("base64url");
    const originValues = options.allowedOrigins ?? (process.env.EOS_MCP_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
    this.allowedOrigins = new Set(originValues.map((origin) => {
      let parsed: URL;
      try { parsed = new URL(origin); } catch { throw new Error(`Invalid EOS MCP allowed origin: ${origin}`); }
      if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.origin !== origin || origin === "*") {
        throw new Error(`EOS MCP allowed origins must be exact HTTP(S) origins without paths: ${origin}`);
      }
      return origin;
    }));
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isInteger(this.maxSessions) || this.maxSessions < 1) throw new Error("maxSessions must be a positive integer.");
    if (!Number.isInteger(this.maxRequestBytes) || this.maxRequestBytes < 1) throw new Error("maxRequestBytes must be a positive integer.");
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 1) throw new Error("requestTimeoutMs must be a positive integer.");
  }

  /**
   * Main HTTP request router implementing the MCP 2024-11-05 spec.
   * Optimized for Antigravity (prompts/resources), Cursor, and Claude Code.
   */
  public async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // ── CORS ────────────────────────────────────────────────────────────────
    const allowedOrigin =
      process.env["EOS_MCP_ALLOWED_ORIGIN"] ??
      (process.env["NODE_ENV"] === "production" ? "null" : "*");
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // DNS Rebinding Guard: Verify Host header
    const hostHeader = (req.headers.host || "").toLowerCase();
    if (hostHeader.includes("@") || hostHeader.includes("..")) {
      this.writeJson(res, 403, { error: "Invalid Host header format." });
      req.resume();
      return;
    }

    // Authentication: Bearer token comparison in constant time
    const authorization = req.headers.authorization || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const suppliedBuffer = Buffer.from(suppliedToken, "utf8");
    const expectedBuffer = Buffer.from(this.authToken, "utf8");
    const authenticated = suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
    if (!authenticated) {
      this.writeJson(res, 401, { error: "Unauthorized." }, { "WWW-Authenticate": "Bearer" });
      req.resume();
      return;
    }

    // MCP-Protocol-Version validation
    const protocolVersionHeader = (req.headers["mcp-protocol-version"] || req.headers["x-mcp-protocol-version"]) as string | undefined;
    if (protocolVersionHeader && !SUPPORTED_MCP_PROTOCOL_VERSIONS.has(protocolVersionHeader)) {
      this.writeJson(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: `Unsupported MCP-Protocol-Version: '${protocolVersionHeader}'. Supported: 2025-06-18, 2025-03-26, 2024-11-05`
        }
      });
      req.resume();
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    } catch {
      this.writeJson(res, 400, { error: "Invalid request URL." });
      return;
    }
    const pathname = parsedUrl.pathname;

    // ── Auth ─────────────────────────────────────────────────────────────────
    const skipAuth = pathname === "/health" || pathname === "/status" || pathname === "/metrics";
    if (!skipAuth) {
      const expectedToken = process.env["EOS_MCP_TOKEN"];
      if (expectedToken) {
        const authHeader = (req.headers["authorization"] as string) ?? "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const providedBuf = Buffer.from(provided.padEnd(expectedToken.length, "\0"));
        const expectedBuf = Buffer.from(expectedToken);
        const tokenValid = provided.length === expectedToken.length &&
          crypto.timingSafeEqual(providedBuf, expectedBuf);
        if (!tokenValid) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer realm="eos-mcp"',
          });
          res.end(JSON.stringify({
            error: "Unauthorized", code: "EOS_MCP_AUTH_REQUIRED",
            message: "Set EOS_MCP_TOKEN env var and pass Authorization: Bearer <token>",
          }));
          return;
        }
      }
    }

    // ── /health ──────────────────────────────────────────────────────────────
    if (pathname === "/health" || pathname === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "UP",
        server: "eos-system-mcp-stream",
        version: _serverVersion,
        protocolVersion: "2024-11-05",
        activeSessions: this.sessionManager.getActiveSessions().length,
        uptimeSeconds: Math.floor(process.uptime()),
        transports: ["stdio", "sse", "http-jsonrpc"],
      }));
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
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress || "unknown";

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders?.();

      const session = this.sessionManager.createSession(res, clientIp);

      if (!session) {
        // Per-IP cap exceeded — respond 429 (but headers already sent for SSE)
        // We can only signal via a data event, then close
        res.write(`event: error\ndata: ${JSON.stringify({ code: 429, message: "Too many SSE connections from this IP" })}\n\n`);
        res.end();
        return;
      }

      session.sendEvent("endpoint", `/message?sessionId=${session.id}`);
      req.on("close", () => this.sessionManager.removeSession(session.id));
      return;
    }

    // ── /message — async, deduplicated JSON-RPC dispatch ────────────────────
    if (req.method === "POST" && pathname === "/message") {
      const sessionId = parsedUrl.searchParams.get("sessionId") || (req.headers["x-session-id"] as string | undefined);
      const session = sessionId ? this.sessionManager.getSession(sessionId) : undefined;
      if (!session) {
        this.writeJson(res, 404, { error: "MCP session not found." });
        req.resume();
        return;
      }
      const contentType = req.headers["content-type"] || "";
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        this.writeJson(res, 415, { error: "Content-Type must be application/json." });
        req.resume();
        return;
      }
      const contentLength = Number(req.headers["content-length"] || 0);
      if (Number.isFinite(contentLength) && contentLength > this.maxRequestBytes) {
        this.writeJson(res, 413, { error: "Request body exceeds the configured size limit." });
        req.resume();
        return;
      }

      // Body size cap (CVE-1 fix)
      const MAX_BODY_BYTES = 1 * 1024 * 1024;
      const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
      if (contentLength > MAX_BODY_BYTES) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload Too Large", code: "EOS_BODY_TOO_LARGE", maxBytes: MAX_BODY_BYTES }));
        return;
      }

      let body = "";
      let bytesReceived = 0;
      req.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
        if (bytesReceived > MAX_BODY_BYTES) {
          req.socket.destroy();
          if (!res.writableEnded) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Payload Too Large", code: "EOS_BODY_TOO_LARGE", maxBytes: MAX_BODY_BYTES }));
          }
          return;
        }
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          if (!body.trim()) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Empty request body" } }));
            return;
          }

          let jsonRpcReq: JsonRpcRequest;
          try {
            jsonRpcReq = JSON.parse(body);
          } catch (parseErr) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0", id: null,
              error: { code: -32700, message: "Parse error: Invalid JSON", data: String(parseErr) },
            }));
            return;
          }

          // ── Request deduplication ─────────────────────────────────────────
          // Antigravity and some clients retry on network timeout — same request ID
          // arriving twice would dispatch the same tool twice (dangerous for mutations).
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
            const dedupKey = `${sessionId ?? "global"}:${jsonRpcReq.id}`;
            if (this.inFlight.has(dedupKey)) {
              res.writeHead(202, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpcReq.id, result: { status: "DUPLICATE_IN_FLIGHT" } }));
              return;
            }
            this.inFlight.add(dedupKey);
            // Auto-clean after 30s regardless of completion
            setTimeout(() => this.inFlight.delete(dedupKey), 30_000).unref();
          }

          const progressCallback = (progress: number, total?: number, msg?: string) => {
            if (session && jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
              session.sendProgress(jsonRpcReq.id, progress, total, msg);
            }
          };

          // ── Fully async dispatch ──────────────────────────────────────────
          // dispatchJsonRpc is now awaited properly — never blocks other requests
          const response = await this.dispatchJsonRpc(jsonRpcReq, progressCallback);

          // Clean up dedup key on completion
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) {
            this.inFlight.delete(`${sessionId ?? "global"}:${jsonRpcReq.id}`);
          }

          if (session && response) session.sendEvent("message", response);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(response ? JSON.stringify(response) : "");
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
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify(errorRes));
          }
        }
      });
      return;
    }

    // ── /prompts — Antigravity prompt discovery ───────────────────────────────
    if (req.method === "GET" && pathname === "/prompts") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ prompts: EOS_PROMPTS }));
      return;
    }

    // ── /resources — Antigravity resource discovery ───────────────────────────
    if (req.method === "GET" && pathname === "/resources") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ resources: EOS_RESOURCES }));
      return;
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
  }

  /** Dispatches JSON-RPC request to EosMcpServer. Fully async — non-blocking. */
  public async dispatchJsonRpc(
    req: JsonRpcRequest,
    onProgress?: (progress: number, total?: number, message?: string) => void
  ): Promise<JsonRpcResponse | null> {
    return this.mcpServer.handleRequest(req, onProgress);
  }

  /** Starts the HTTP server. */
  public listen(port = 3333, host = "127.0.0.1"): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch((err) => {
          if (!res.writableEnded) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: (err as Error).message }));
          }
        });
      });
      this.server.on("error", reject);
      this.server.listen(port, host, () => resolve(this.server!));
    });
  }

  /** Gracefully closes the server and all active sessions. */
  public close(): Promise<void> {
    if (this.reaperInterval) {
      clearInterval(this.reaperInterval);
      this.reaperInterval = null;
    }
    this.sessionManager.closeAll();
    for (const session of this.streamableSessions.values()) {
      session.close("SERVER_SHUTDOWN");
    }
    this.streamableSessions.clear();
    return new Promise((resolve) => {
      if (this.server) { this.server.close(() => resolve()); this.server = null; }
      else resolve();
    });
  }
}
