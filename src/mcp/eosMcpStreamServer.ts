/**
 * EOS SYSTEM — MODEL CONTEXT PROTOCOL (MCP) LIVE STREAM SERVER (Layer 0)
 * Governed by ADR-034, SPEC-027, FR-066..FR-070, BDD-061..BDD-063
 *
 * Implements bi-directional streaming for Cursor, Antigravity, and Claude Code:
 * - Persistent Server-Sent Events (SSE) on GET /sse with endpoint negotiation.
 * - JSON-RPC 2.0 message dispatching via POST /message?sessionId=<sessionId>.
 * - Real-time notifications (notifications/progress) down active SSE streams.
 * - Keep-alive heartbeats (: keep-alive) and automatic session garbage collection.
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

const MCP_HTTP_READ_ONLY_TOOLS = new Set([
  "eos_health_check",
  "eos_amplify_prompt",
  "eos_check_architecture",
  "eos_evaluate_decision",
  "eos_spotify_shuffle",
  "eos_optimize_context",
]);
const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
export const MAX_SESSIONS = 16;
const DEFAULT_MAX_SESSIONS = MAX_SESSIONS;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const PACKAGE_VERSION = (() => {
  try {
    return (
      (JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string })
        .version || "unknown"
    );
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
        message,
      },
    };
    return this.sendEvent("message", notification);
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (!this.res.writableEnded && this.res.writable) {
      try {
        this.res.end();
      } catch {
        // Safe ignored on client abrupt termination
      }
    }
  }

  public isAlive(): boolean {
    return !this.closed && !this.res.writableEnded && this.res.writable;
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

  public _gc(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (!session.isAlive() || now - session.lastActivity > 60_000) {
        session.close();
        this.sessions.delete(id);
      }
    }
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

  constructor(projectRoot?: string, heartbeatIntervalMs = 15000, options: EosMcpStreamServerOptions = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.mcpServer = new EosMcpServer(this.projectRoot);
    this.sessionManager = new EosMcpSessionManager(heartbeatIntervalMs);
    const configuredToken = options.authToken ?? process.env.EOS_MCP_HTTP_TOKEN;
    if (configuredToken !== undefined && Buffer.byteLength(configuredToken, "utf8") < 32) {
      throw new Error("EOS MCP HTTP bearer tokens must contain at least 32 bytes.");
    }
    this.authToken = configuredToken || crypto.randomBytes(32).toString("base64url");
    const originValues =
      options.allowedOrigins ??
      (process.env.EOS_MCP_ALLOWED_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    this.allowedOrigins = new Set(
      originValues.map((origin) => {
        let parsed: URL;
        try {
          parsed = new URL(origin);
        } catch {
          throw new Error(`Invalid EOS MCP allowed origin: ${origin}`);
        }
        if (
          (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
          parsed.origin !== origin ||
          origin === "*"
        ) {
          throw new Error(`EOS MCP allowed origins must be exact HTTP(S) origins without paths: ${origin}`);
        }
        return origin;
      }),
    );
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isInteger(this.maxSessions) || this.maxSessions < 1)
      throw new Error("maxSessions must be a positive integer.");
    if (!Number.isInteger(this.maxRequestBytes) || this.maxRequestBytes < 1)
      throw new Error("maxRequestBytes must be a positive integer.");
    if (!Number.isInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 1)
      throw new Error("requestTimeoutMs must be a positive integer.");
  }

  /**
   * Main HTTP request router implementing the MCP 2024-11-05 spec
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
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");
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

    const authorization = req.headers.authorization || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const suppliedBuffer = Buffer.from(suppliedToken, "utf8");
    const expectedBuffer = Buffer.from(this.authToken, "utf8");
    const authenticated =
      suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
    if (!authenticated) {
      this.writeJson(res, 401, { error: "Unauthorized." }, { "WWW-Authenticate": "Bearer" });
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

    if (pathname === "/health" || pathname === "/status") {
      this.writeJson(res, 200, {
        status: "UP",
        server: "eos-system-mcp-stream",
        version: PACKAGE_VERSION,
        protocolVersion: "2024-11-05",
        activeSessions: this.sessionManager.getActiveSessions().length,
        uptimeSeconds: Math.floor(process.uptime()),
        transports: ["stdio", "sse"],
      });
      return;
    }

    if (!this._authenticate(req)) {
      this.writeJson(res, 401, { error: "Unauthorized" });
      return;
    }

    if (req.method === "GET" && pathname === "/metrics") {
      const exporter = new EosPrometheusExporter(this.projectRoot);
      res.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      });
      res.end(exporter.formatPrometheusText());
      return;
    }

    if (req.method === "GET" && (pathname === "/sse" || pathname === "/events")) {
      if (this.sessionManager.getActiveSessions().length >= this.maxSessions) {
        this.writeJson(res, 503, { error: "MCP session capacity reached." });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
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
        const inputError =
          error instanceof HttpInputError ? error : new HttpInputError(400, "Request body could not be read.");
        this.writeJson(res, inputError.statusCode, { error: inputError.message });
        return;
      }
      let jsonRpcReq: JsonRpcRequest;
      try {
        const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
        jsonRpcReq = parsed as JsonRpcRequest;
        if (jsonRpcReq.jsonrpc !== "2.0" || typeof jsonRpcReq.method !== "string")
          throw new Error("invalid JSON-RPC envelope");
      } catch {
        this.writeJson(res, 400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Invalid JSON-RPC request." },
        });
        return;
      }

      if (jsonRpcReq.method === "tools/call") {
        const name = (jsonRpcReq.params as { name?: unknown } | undefined)?.name;
        if (typeof name !== "string" || !MCP_HTTP_READ_ONLY_TOOLS.has(name)) {
          this.writeJson(res, 200, {
            jsonrpc: "2.0",
            id: jsonRpcReq.id ?? null,
            error: { code: -32601, message: "Tool is not exposed by the read-only MCP HTTP endpoint." },
          });
          return;
        }
        const args = (jsonRpcReq.params as { arguments?: unknown }).arguments;
        const argumentError = this.validateReadOnlyToolArguments(name, args);
        if (argumentError) {
          this.writeJson(res, 200, {
            jsonrpc: "2.0",
            id: jsonRpcReq.id ?? null,
            error: { code: -32602, message: argumentError },
          });
          return;
        }
      } else if (!["initialize", "ping", "tools/list", "notifications/initialized"].includes(jsonRpcReq.method)) {
        this.writeJson(res, 200, {
          jsonrpc: "2.0",
          id: jsonRpcReq.id ?? null,
          error: { code: -32601, message: "Method is not exposed by the MCP HTTP endpoint." },
        });
        return;
      }

      try {
        const progressCallback = (progress: number, total?: number, message?: string) => {
          if (jsonRpcReq.id !== undefined && jsonRpcReq.id !== null)
            session.sendProgress(jsonRpcReq.id, progress, total, message);
        };
        let response = await this.dispatchJsonRpc(jsonRpcReq, progressCallback);
        if (jsonRpcReq.method === "tools/list" && response?.result?.tools) {
          response.result.tools = response.result.tools
            .filter((tool: { name: string }) => MCP_HTTP_READ_ONLY_TOOLS.has(tool.name))
            .map((tool: { name: string; description?: string; inputSchema?: Record<string, any> }) => {
              if (tool.name === "eos_optimize_context") {
                return {
                  ...tool,
                  description:
                    "Compresses caller-submitted text only; repository file reads are disabled on this HTTP transport.",
                  inputSchema: {
                    type: "object",
                    properties: {
                      content: { type: "string", description: "Text to compress; maximum 256 KiB in UTF-8." },
                    },
                    required: ["content"],
                    additionalProperties: false,
                  },
                };
              }
              if (tool.name === "eos_check_architecture") {
                return {
                  ...tool,
                  description:
                    "Runs bounded static checks against the repository src directory only; it does not execute tests.",
                  inputSchema: {
                    type: "object",
                    properties: { targetDir: { type: "string", enum: ["src"] } },
                    additionalProperties: false,
                  },
                };
              }
              if (tool.name === "eos_spotify_shuffle" && tool.inputSchema?.properties?.tracks) {
                return {
                  ...tool,
                  inputSchema: {
                    ...tool.inputSchema,
                    properties: {
                      ...tool.inputSchema.properties,
                      tracks: { ...tool.inputSchema.properties.tracks, maxItems: 128 },
                    },
                  },
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
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(serialized);
      } catch {
        this.writeJson(res, 500, {
          jsonrpc: "2.0",
          id: jsonRpcReq.id ?? null,
          error: { code: -32603, message: "Internal server error." },
        });
      }
      return;
    }

    this.writeJson(res, 404, { error: "Not found." });
    req.resume();
  }

  private writeJson(
    res: http.ServerResponse,
    statusCode: number,
    payload: unknown,
    headers: Record<string, string> = {},
  ): void {
    if (res.writableEnded) return;
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    });
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
          req.socket.destroy();
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
      typeof args[field] === "string" &&
      Buffer.byteLength(args[field] as string, "utf8") <= maxBytes &&
      (allowEmpty || (args[field] as string).length > 0);
    if (toolName === "eos_optimize_context") {
      if (Object.hasOwn(args, "filePath")) return "Repository file access is disabled by the read-only HTTP policy.";
      if (!boundedText("content", 256 * 1024)) return "content must be non-empty text no larger than 256 KiB.";
    }
    if (toolName === "eos_check_architecture" && args.targetDir !== undefined && args.targetDir !== "src") {
      return "The HTTP endpoint only scans the repository src directory.";
    }
    if (toolName === "eos_amplify_prompt" && !boundedText("rawPrompt", 8192))
      return "rawPrompt must be non-empty text no larger than 8 KiB.";
    if (toolName === "eos_evaluate_decision") {
      for (const field of ["title", "description", "proposedAction"]) {
        if (!boundedText(field, 16 * 1024)) return `${field} must be non-empty text no larger than 16 KiB.`;
      }
    }
    if (
      toolName === "eos_spotify_shuffle" &&
      args.tracks !== undefined &&
      (!Array.isArray(args.tracks) || args.tracks.length > 128)
    ) {
      return "tracks must be an array containing no more than 128 items.";
    }
    return null;
  }

  /**
   * Dispatches JSON-RPC request to EosMcpServer with optional progress callback
   */
  public async dispatchJsonRpc(
    req: JsonRpcRequest,
    onProgress?: (progress: number, total?: number, message?: string) => void,
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

  private _authenticate(req: http.IncomingMessage): boolean {
    if (!this.authToken) return true;
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    return authHeader === `Bearer ${this.authToken}`;
  }

  /**
   * Closes active server and all SSE sessions
   */
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
