/**
 * EOS SYSTEM — MODEL CONTEXT PROTOCOL (MCP) STREAMABLE HTTP SERVER (Layer 0)
 * Governed by SPEC-027, SPEC-140, CHANGE-075, ADR-0172, ADR-0173
 *
 * Implements Modern Streamable HTTP Transport for Cursor, Antigravity, and Claude Code:
 * - Unified endpoint POST /api/mcp (dual negotiation: application/json vs text/event-stream).
 * - Protocol Version Negotiation (2025-06-18, 2025-03-26, 2024-11-05).
 * - Cryptographically bound MCP-Session-Id (256-bit CSPRNG bound to token hash).
 * - Bounded LRU session eviction (capacity 16) and ring-buffer event replay (Last-Event-ID).
 * - DNS Rebinding & Payload Overflow protection (1 MiB cutoff, Host/Origin validation).
 * - Legacy compatibility shim for GET /sse and POST /message.
 *
 * Invariant: 100% Layer-0 purity with zero external npm runtime dependencies.
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { URL } from "node:url";
import { EosMcpServer, type JsonRpcRequest, type JsonRpcResponse } from "./eosMcpServer.ts";
import { EosPrometheusExporter } from "../core/eosPrometheusExporter.ts";

export interface ProgressNotificationParams {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

export const SUPPORTED_MCP_PROTOCOL_VERSIONS = new Set([
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
]);

const MCP_STREAMABLE_TOOLS = new Set([
  "eos_health_check",
  "eos_amplify_prompt",
  "eos_check_architecture",
  "eos_evaluate_decision",
  "eos_spotify_shuffle",
  "eos_optimize_context",
  "eos_slsa_provenance_sbom"
]);

const MCP_LEGACY_READ_ONLY_TOOLS = new Set([
  "eos_health_check",
  "eos_amplify_prompt",
  "eos_check_architecture",
  "eos_evaluate_decision",
  "eos_spotify_shuffle",
  "eos_optimize_context"
]);

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024; // 1 MiB hard cutoff
const DEFAULT_MAX_SESSIONS = 16;
const DEFAULT_MAX_BUFFERED_EVENTS = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

const PACKAGE_VERSION = (() => {
  try {
    return (JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string }).version || "unknown";
  } catch {
    return "unknown";
  }
})();

export interface EosMcpStreamServerOptions {
  authToken?: string;
  allowedOrigins?: string[];
  maxSessions?: number;
  maxRequestBytes?: number;
  requestTimeoutMs?: number;
}

class HttpInputError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpInputError";
    this.statusCode = statusCode;
  }
}

/**
 * Streamable SSE event record stored in the bounded session ring buffer
 */
export interface StreamableEvent {
  readonly id: number;
  readonly event: string;
  readonly data: any;
  readonly timestamp: number;
}

/**
 * Streamable HTTP Session with bounded ring buffer for Last-Event-ID replay
 */
export class StreamableSession {
  public readonly id: string;
  public readonly tokenHash: string;
  public readonly createdAt: number;
  public lastActivity: number;
  public readonly ringBuffer: StreamableEvent[] = [];
  public nextEventId = 1;
  public activeResponse: http.ServerResponse | null = null;
  private readonly maxBufferSize: number;

  constructor(id: string, tokenHash: string, maxBufferSize = DEFAULT_MAX_BUFFERED_EVENTS) {
    this.id = id;
    this.tokenHash = tokenHash;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.maxBufferSize = maxBufferSize;
  }

  public addEvent(event: string, data: any): StreamableEvent {
    const record: StreamableEvent = {
      id: this.nextEventId++,
      event,
      data,
      timestamp: Date.now()
    };
    this.ringBuffer.push(record);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }
    this.lastActivity = Date.now();
    return record;
  }

  public getEventsSince(lastEventId: number): StreamableEvent[] | null {
    if (this.ringBuffer.length === 0) {
      return lastEventId === 0 ? [] : null;
    }
    const oldestId = this.ringBuffer[0].id;
    const newestId = this.ringBuffer[this.ringBuffer.length - 1].id;
    if (lastEventId < oldestId - 1 || lastEventId > newestId) {
      return null; // Overrun / evicted from bounded ring buffer or non-existent future ID
    }
    return this.ringBuffer.filter((e) => e.id > lastEventId);
  }

  public close(): void {
    if (this.activeResponse && !this.activeResponse.writableEnded) {
      try {
        this.activeResponse.end();
      } catch {
        // ignore
      }
    }
    this.activeResponse = null;
    this.ringBuffer.length = 0;
  }
}

/**
 * Legacy SSE session for backward compatibility with 2024-11-05 GET /sse
 */
export class EosMcpSession {
  public readonly id: string;
  public readonly createdAt: number;
  public lastActivity: number;
  private readonly res: http.ServerResponse;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(id: string, res: http.ServerResponse, heartbeatIntervalMs = 15000) {
    this.id = id;
    this.res = res;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    if (heartbeatIntervalMs > 0) {
      this.keepAliveTimer = setInterval(() => {
        this.sendHeartbeat();
      }, heartbeatIntervalMs);
    }
  }

  public sendEvent(event: string, data: any): boolean {
    if (this.closed || this.res.writableEnded || !this.res.writable) {
      return false;
    }
    this.lastActivity = Date.now();
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
    try {
      this.res.write(": keep-alive\n\n");
    } catch {
      this.close();
    }
  }

  public sendProgress(token: string | number, progress: number, total?: number, message?: string): boolean {
    const notification: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress,
        total,
        message
      }
    };
    return this.sendEvent("message", notification);
  }

  public isAlive(): boolean {
    return !this.closed && !this.res.writableEnded && this.res.writable;
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (!this.res.writableEnded) {
      try {
        this.res.end();
      } catch {
        // Ignore errors during closing
      }
    }
  }
}

export class EosMcpSessionManager {
  private readonly sessions = new Map<string, EosMcpSession>();
  private readonly heartbeatIntervalMs: number;

  constructor(heartbeatIntervalMs = 15000) {
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  public createSession(res: http.ServerResponse): EosMcpSession {
    const sessionId = crypto.randomUUID();
    const session = new EosMcpSession(sessionId, res, this.heartbeatIntervalMs);
    this.sessions.set(sessionId, session);
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
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }
}

export class EosMcpStreamServer {
  public readonly mcpServer: EosMcpServer;
  public readonly sessionManager: EosMcpSessionManager;
  public readonly authToken: string;
  private server: http.Server | null = null;
  private readonly projectRoot: string;
  private readonly allowedOrigins: Set<string>;
  private readonly maxSessions: number;
  private readonly maxRequestBytes: number;
  private readonly requestTimeoutMs: number;
  private readonly streamableSessions = new Map<string, StreamableSession>();

  constructor(projectRoot?: string, heartbeatIntervalMs = 15000, options: EosMcpStreamServerOptions = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.mcpServer = new EosMcpServer(this.projectRoot);
    this.sessionManager = new EosMcpSessionManager(heartbeatIntervalMs);
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
   * Retrieves or creates a Streamable HTTP session bound to the client's token hash.
   */
  public getOrCreateStreamableSession(token: string, requestedSessionId?: string): {
    session: StreamableSession | null;
    error?: { statusCode: number; message: string };
  } {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (requestedSessionId) {
      const existing = this.streamableSessions.get(requestedSessionId);
      if (!existing) {
        return {
          session: null,
          error: { statusCode: 404, message: "MCP session not found. Client must re-initialize." }
        };
      }
      if (existing.tokenHash !== tokenHash) {
        return {
          session: null,
          error: { statusCode: 404, message: "MCP session token mismatch. Client must re-initialize." }
        };
      }
      existing.lastActivity = Date.now();
      return { session: existing };
    }

    // Capacity check with LRU eviction
    if (this.streamableSessions.size >= this.maxSessions) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      for (const [id, s] of this.streamableSessions.entries()) {
        if (s.lastActivity < oldestTime) {
          oldestTime = s.lastActivity;
          oldestId = id;
        }
      }
      if (oldestId) {
        const evicted = this.streamableSessions.get(oldestId);
        evicted?.close();
        this.streamableSessions.delete(oldestId);
      }
    }

    const sessionId = crypto.randomBytes(32).toString("hex");
    const newSession = new StreamableSession(sessionId, tokenHash);
    this.streamableSessions.set(sessionId, newSession);
    return { session: newSession };
  }

  public deleteStreamableSession(sessionId: string, token: string): boolean {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = this.streamableSessions.get(sessionId);
    if (!session || session.tokenHash !== tokenHash) {
      return false;
    }
    session.close();
    this.streamableSessions.delete(sessionId);
    return true;
  }

  /**
   * Main HTTP request router implementing MCP Streamable HTTP & legacy backward compatibility
   */
  public async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    if (origin) {
      if (!this.allowedOrigins.has(origin)) {
        this.writeJson(res, 403, { error: "Origin is not allowed." });
        req.resume();
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Last-Event-ID, MCP-Session-Id, MCP-Protocol-Version, x-session-id");
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      if (!origin) {
        this.writeJson(res, 403, { error: "CORS preflight requires an explicitly allowed Origin." });
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

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

    // Health and Metrics endpoints
    if ((pathname === "/health" || pathname === "/status") && req.method === "GET") {
      this.writeJson(res, 200, {
        status: "UP",
        server: "eos-system-mcp-stream",
        version: PACKAGE_VERSION,
        protocolVersion: "2024-11-05",
        modernProtocolVersion: "2025-06-18",
        supportedProtocolVersions: Array.from(SUPPORTED_MCP_PROTOCOL_VERSIONS),
        activeSessions: this.sessionManager.getActiveSessions().length + this.streamableSessions.size,
        uptimeSeconds: Math.floor(process.uptime()),
        transports: ["stdio", "sse"],
        streamableTransports: ["stdio", "sse", "streamable-http"]
      });
      return;
    }

    if (req.method === "GET" && pathname === "/metrics") {
      const exporter = new EosPrometheusExporter(this.projectRoot);
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache, no-store"
      });
      res.end(exporter.formatPrometheusText());
      return;
    }

    // =========================================================================
    // MODERN MCP STREAMABLE HTTP ROUTE: /api/mcp and /mcp
    // =========================================================================
    if (pathname === "/api/mcp" || pathname === "/mcp") {
      const requestedSessionId = (req.headers["mcp-session-id"] || req.headers["x-session-id"]) as string | undefined;

      // 1. DELETE: Explicit session termination
      if (req.method === "DELETE") {
        if (!requestedSessionId) {
          this.writeJson(res, 400, { error: "MCP-Session-Id header is required to terminate session." });
          return;
        }
        const terminated = this.deleteStreamableSession(requestedSessionId, suppliedToken);
        if (!terminated) {
          this.writeJson(res, 404, { error: "Session not found or token mismatch." });
          return;
        }
        this.writeJson(res, 200, { status: "SESSION_TERMINATED", sessionId: requestedSessionId });
        return;
      }

      // 2. GET: Direct stream attachment for notifications
      if (req.method === "GET") {
        if (!requestedSessionId) {
          this.writeJson(res, 400, { error: "MCP-Session-Id header is required for stream connection." });
          return;
        }
        const sessionResult = this.getOrCreateStreamableSession(suppliedToken, requestedSessionId);
        if (sessionResult.error || !sessionResult.session) {
          this.writeJson(res, sessionResult.error?.statusCode || 404, { error: sessionResult.error?.message || "Session not found." });
          return;
        }
        const session = sessionResult.session;
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "MCP-Session-Id": session.id,
          "MCP-Protocol-Version": "2025-06-18"
        });
        res.flushHeaders?.();
        session.activeResponse = res;
        req.on("close", () => {
          if (session.activeResponse === res) session.activeResponse = null;
        });
        return;
      }

      // 3. POST: JSON-RPC request / response or SSE stream negotiation
      if (req.method === "POST") {
        const sessionResult = this.getOrCreateStreamableSession(suppliedToken, requestedSessionId);
        if (sessionResult.error || !sessionResult.session) {
          this.writeJson(res, sessionResult.error?.statusCode || 404, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32001, message: sessionResult.error?.message || "Session invalid. Client must re-initialize." }
          });
          req.resume();
          return;
        }
        const session = sessionResult.session;

        let rawBody: Buffer;
        try {
          rawBody = await this.readRequestBody(req);
        } catch (error) {
          const inputError = error instanceof HttpInputError ? error : new HttpInputError(400, "Request body could not be read.");
          this.writeJson(res, inputError.statusCode, { error: inputError.message });
          return;
        }

        let jsonRpcReq: JsonRpcRequest;
        try {
          const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
          jsonRpcReq = parsed as JsonRpcRequest;
          if (jsonRpcReq.jsonrpc !== "2.0" || typeof jsonRpcReq.method !== "string") throw new Error("invalid JSON-RPC envelope");
        } catch {
          this.writeJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON-RPC request." } });
          return;
        }

        // Validate notifications without ID (e.g. notifications/initialized)
        const hasId = Object.prototype.hasOwnProperty.call(jsonRpcReq, "id");
        if (!hasId || jsonRpcReq.id === null) {
          if (typeof jsonRpcReq.method === "string" && jsonRpcReq.method.startsWith("notifications/")) {
            res.writeHead(202, {
              "Cache-Control": "no-store",
              "MCP-Session-Id": session.id,
              "MCP-Protocol-Version": "2025-06-18"
            });
            res.end();
            return;
          }
        }

        // Validate Tool Call Permissions
        if (jsonRpcReq.method === "tools/call") {
          const name = (jsonRpcReq.params as { name?: unknown } | undefined)?.name;
          if (typeof name !== "string" || !MCP_STREAMABLE_TOOLS.has(name)) {
            this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32601, message: "Tool is not exposed by the read-only MCP HTTP endpoint." } });
            return;
          }
          const args = (jsonRpcReq.params as { arguments?: unknown }).arguments;
          const argumentError = this.validateReadOnlyToolArguments(name, args);
          if (argumentError) {
            this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32602, message: argumentError } });
            return;
          }
        } else if (!["initialize", "ping", "tools/list", "notifications/initialized"].includes(jsonRpcReq.method)) {
          this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32601, message: "Method is not exposed by the MCP HTTP endpoint." } });
          return;
        }

        const acceptHeader = String(req.headers.accept || "").toLowerCase();
        const wantsSse = acceptHeader.includes("text/event-stream");

        // Last-Event-ID replay verification
        let replayEvents: StreamableEvent[] = [];
        const lastEventIdHeader = req.headers["last-event-id"];
        if (lastEventIdHeader !== undefined) {
          const lastId = parseInt(String(lastEventIdHeader), 10);
          if (isNaN(lastId)) {
            this.writeJson(res, 400, { error: "Last-Event-ID must be an integer." });
            return;
          }
          const foundEvents = session.getEventsSince(lastId);
          if (foundEvents === null) {
            this.writeJson(res, 400, { error: "Last-Event-ID not found in session buffer." });
            return;
          }
          replayEvents = foundEvents;
        }

        try {
          let response = await this.dispatchJsonRpc(jsonRpcReq);
          if (jsonRpcReq.method === "tools/list" && response?.result?.tools) {
            response = {
              ...response,
              result: {
                ...response.result,
                tools: response.result.tools
                  .filter((tool: { name: string }) => MCP_STREAMABLE_TOOLS.has(tool.name))
              }
            };
          }
          const serialized = response ? JSON.stringify(response) : "";

          if (Buffer.byteLength(serialized, "utf8") > this.maxRequestBytes) {
            this.writeJson(res, 502, { error: "MCP response exceeds the configured size limit." });
            return;
          }

          const streamEvent = session.addEvent("message", response);

          if (wantsSse) {
            res.writeHead(200, {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "MCP-Session-Id": session.id,
              "MCP-Protocol-Version": "2025-06-18"
            });
            for (const re of replayEvents) {
              res.write(`id: ${re.id}\nevent: ${re.event}\ndata: ${JSON.stringify(re.data)}\n\n`);
            }
            res.write(`id: ${streamEvent.id}\nevent: message\ndata: ${serialized}\n\n`);
            res.end();
          } else {
            res.writeHead(200, {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
              "MCP-Session-Id": session.id,
              "MCP-Protocol-Version": "2025-06-18"
            });
            res.end(serialized);
          }
        } catch {
          this.writeJson(res, 500, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32603, message: "Internal server error." } });
        }
        return;
      }

      this.writeJson(res, 405, { error: "Method not allowed on /api/mcp." });
      return;
    }

    // =========================================================================
    // LEGACY 2024-11-05 ROUTES (GET /sse and POST /message) — Backward Compat
    // =========================================================================
    if (req.method === "GET" && (pathname === "/sse" || pathname === "/events")) {
      if (this.sessionManager.getActiveSessions().length >= this.maxSessions) {
        this.writeJson(res, 503, { error: "MCP session capacity reached." });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff"
      });
      res.flushHeaders?.();
      const session = this.sessionManager.createSession(res);
      session.sendEvent("endpoint", `/message?sessionId=${session.id}`);
      req.on("close", () => this.sessionManager.removeSession(session.id));
      return;
    }

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

      let rawBody: Buffer;
      try {
        rawBody = await this.readRequestBody(req);
      } catch (error) {
        const inputError = error instanceof HttpInputError ? error : new HttpInputError(400, "Request body could not be read.");
        this.writeJson(res, inputError.statusCode, { error: inputError.message });
        return;
      }
      let jsonRpcReq: JsonRpcRequest;
      try {
        const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
        jsonRpcReq = parsed as JsonRpcRequest;
        if (jsonRpcReq.jsonrpc !== "2.0" || typeof jsonRpcReq.method !== "string") throw new Error("invalid JSON-RPC envelope");
      } catch {
        this.writeJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON-RPC request." } });
        return;
      }

      if (jsonRpcReq.method === "tools/call") {
        const name = (jsonRpcReq.params as { name?: unknown } | undefined)?.name;
        if (typeof name !== "string" || !MCP_LEGACY_READ_ONLY_TOOLS.has(name)) {
          this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32601, message: "Tool is not exposed by the read-only MCP HTTP endpoint." } });
          return;
        }
        const args = (jsonRpcReq.params as { arguments?: unknown }).arguments;
        const argumentError = this.validateReadOnlyToolArguments(name, args);
        if (argumentError) {
          this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32602, message: argumentError } });
          return;
        }
      } else if (!["initialize", "ping", "tools/list", "notifications/initialized"].includes(jsonRpcReq.method)) {
        this.writeJson(res, 200, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32601, message: "Method is not exposed by the MCP HTTP endpoint." } });
        return;
      }

      try {
        const progressCallback = (progress: number, total?: number, message?: string) => {
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null) session.sendProgress(jsonRpcReq.id, progress, total, message);
        };
        let response = await this.dispatchJsonRpc(jsonRpcReq, progressCallback);
        if (jsonRpcReq.method === "tools/list" && response?.result?.tools) {
          response.result.tools = response.result.tools
            .filter((tool: { name: string }) => MCP_LEGACY_READ_ONLY_TOOLS.has(tool.name))
            .map((tool: { name: string; description?: string; inputSchema?: Record<string, any> }) => {
              if (tool.name === "eos_optimize_context") {
                return {
                  ...tool,
                  description: "Compresses caller-submitted text only; repository file reads are disabled on this HTTP transport.",
                  inputSchema: {
                    type: "object",
                    properties: { content: { type: "string", description: "Text to compress; maximum 256 KiB in UTF-8." } },
                    required: ["content"],
                    additionalProperties: false
                  }
                };
              }
              if (tool.name === "eos_check_architecture") {
                return {
                  ...tool,
                  description: "Runs bounded static checks against the repository src directory only; it does not execute tests.",
                  inputSchema: {
                    type: "object",
                    properties: { targetDir: { type: "string", enum: ["src"] } },
                    additionalProperties: false
                  }
                };
              }
              if (tool.name === "eos_spotify_shuffle" && tool.inputSchema?.properties?.tracks) {
                return {
                  ...tool,
                  inputSchema: {
                    ...tool.inputSchema,
                    properties: {
                      ...tool.inputSchema.properties,
                      tracks: { ...tool.inputSchema.properties.tracks, maxItems: 128 }
                    }
                  }
                };
              }
              return tool;
            });
        }
        const serialized = response ? JSON.stringify(response) : "";
        if (Buffer.byteLength(serialized, "utf8") > this.maxRequestBytes) {
          this.writeJson(res, 502, { error: "MCP response exceeds the configured size limit." });
          return;
        }
        if (response) session.sendEvent("message", response);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(serialized);
      } catch {
        this.writeJson(res, 500, { jsonrpc: "2.0", id: jsonRpcReq.id ?? null, error: { code: -32603, message: "Internal server error." } });
      }
      return;
    }

    this.writeJson(res, 404, { error: "Not found." });
    req.resume();
  }

  private writeJson(res: http.ServerResponse, statusCode: number, payload: unknown, headers: Record<string, string> = {}): void {
    if (res.writableEnded) return;
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
    res.end(JSON.stringify(payload));
  }

  private readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let settled = false;
      const finish = (error?: Error, body?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
        req.off("aborted", onAborted);
        if (error) {
          req.resume();
          reject(error);
        } else {
          resolve(body || Buffer.alloc(0));
        }
      };
      const onData = (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > this.maxRequestBytes) {
          finish(new HttpInputError(413, "Request body exceeds the configured size limit."));
          return;
        }
        chunks.push(buffer);
      };
      const onEnd = () => finish(undefined, Buffer.concat(chunks, totalBytes));
      const onError = () => finish(new HttpInputError(400, "Request body could not be read."));
      const onAborted = () => finish(new HttpInputError(400, "Request body was interrupted."));
      const timer = setTimeout(() => finish(new HttpInputError(408, "Request body timed out.")), this.requestTimeoutMs);
      req.on("data", onData);
      req.once("end", onEnd);
      req.once("error", onError);
      req.once("aborted", onAborted);
    });
  }

  private validateReadOnlyToolArguments(toolName: string, value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "Tool arguments must be a JSON object.";
    const args = value as Record<string, unknown>;
    const boundedText = (field: string, maxBytes: number, allowEmpty = false) =>
      typeof args[field] === "string" && Buffer.byteLength(args[field] as string, "utf8") <= maxBytes && (allowEmpty || (args[field] as string).length > 0);
    if (toolName === "eos_optimize_context") {
      if (Object.hasOwn(args, "filePath")) return "Repository file access is disabled by the read-only HTTP policy.";
      if (!boundedText("content", 256 * 1024)) return "content must be non-empty text no larger than 256 KiB.";
    }
    if (toolName === "eos_check_architecture" && args.targetDir !== undefined && args.targetDir !== "src") {
      return "The HTTP endpoint only scans the repository src directory.";
    }
    if (toolName === "eos_amplify_prompt" && !boundedText("rawPrompt", 8192)) return "rawPrompt must be non-empty text no larger than 8 KiB.";
    if (toolName === "eos_evaluate_decision") {
      for (const field of ["title", "description", "proposedAction"]) {
        if (!boundedText(field, 16 * 1024)) return `${field} must be non-empty text no larger than 16 KiB.`;
      }
    }
    if (toolName === "eos_spotify_shuffle" && args.tracks !== undefined && (!Array.isArray(args.tracks) || args.tracks.length > 128)) {
      return "tracks must be an array containing no more than 128 items.";
    }
    if (toolName === "eos_slsa_provenance_sbom") {
      if (args.mode !== undefined && (typeof args.mode !== "string" || !["verify", "sbom", "slsa", "both"].includes(args.mode))) {
        return "mode must be one of: verify, sbom, slsa, both.";
      }
      if (args.commitSha !== undefined && typeof args.commitSha !== "string") {
        return "commitSha must be a string.";
      }
    }
    return null;
  }

  /**
   * Dispatches JSON-RPC request to EosMcpServer with optional progress callback
   */
  public async dispatchJsonRpc(
    req: JsonRpcRequest,
    onProgress?: (progress: number, total?: number, message?: string) => void
  ): Promise<JsonRpcResponse | null> {
    return this.mcpServer.handleRequest(req, onProgress);
  }

  /**
   * Starts local HTTP listening daemon
   */
  public listen(port = 3333, host = "127.0.0.1"): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch((err) => {
          if (!res.writableEnded) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error." }));
          }
        });
      });
      this.server.requestTimeout = this.requestTimeoutMs;
      this.server.headersTimeout = Math.max(this.requestTimeoutMs + 1000, 11_000);

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(port, host, () => {
        resolve(this.server!);
      });
    });
  }

  /**
   * Closes active server and all sessions
   */
  public close(): Promise<void> {
    this.sessionManager.closeAll();
    for (const session of this.streamableSessions.values()) {
      session.close();
    }
    this.streamableSessions.clear();
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
