# PLAN-022: BI-DIRECTIONAL MCP LIVE STREAM SERVER (SSE & STDIO) FOR CURSOR & ANTIGRAVITY

- **Plan ID**: `PLAN-022`
- **Related Spec**: `SPEC-029-MCP-STREAM-SERVER`
- **Architect**: Valentín Flórez Arbeláez
- **Status**: `APPROVED`
- **Date**: 2026-10-25

---

## 1. Architecture Overview & High-Level Design

```
+---------------------------------------------------------------------------------+
|                         CLIENT RUNTIMES (IDEs & AGENTS)                         |
|                                                                                 |
|       +------------------------+             +------------------------+         |
|       |     Cursor IDE         |             |   Google Antigravity   |         |
|       +-----------+------------+             +-----------+------------+         |
|                   |                                      |                      |
+-------------------|--------------------------------------|----------------------+
                    |                                      |
                    | (1) GET /sse                         | (Stdio Pipe)
                    v                                      v
+---------------------------------------------------------------------------------+
|                        EOS SOVEREIGN MCP CONTROL PLANE                          |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |             EosMcpStreamServer (src/mcp/eosMcpStreamServer.ts)            |  |
|  |                                                                           |  |
|  |  +---------------------------+       +---------------------------------+  |  |
|  |  |    EosMcpSessionManager   |       |       Stdio Stream Loop         |  |  |
|  |  | - Map<sessionId, Session> |       | - readline.createInterface      |  |  |
|  |  | - Periodic Keepalive Ping |       | - stdout (data) / stderr (logs) |  |  |
|  |  | - Auto-cleanup on disconnect      | - JSON-RPC 2.0 Parser           |  |  |
|  |  +-------------+-------------+       +----------------+----------------+  |  |
|  |                |                                      |                   |  |
|  |                +------------------+-------------------+                   |  |
|  |                                   |                                       |  |
|  |                                   v                                       |  |
|  |  +---------------------------------------------------------------------+  |  |
|  |  |          EosMcpServer Core Router (src/mcp/eosMcpServer.ts)         |  |  |
|  |  |                                                                     |  |
|  |  |  - initialize, tools/list, tools/call, resources/list, resources/read  |
|  |  |  - Tools:                                                           |  |
|  |  |    * eos_query_topology (14 nodes, 3 rings, blast radius)           |  |
|  |  |    * eos_wasm_compress (AST token reduction outline)                |  |
|  |  |    * eos_audit_fleet (SLSA L4, registry status)                     |  |
|  |  |    * eos_model_route (Gemini, Claude, GPT, DeepSeek, Grok)          |  |
|  |  |    * eos_turbo_verify, eos_amplify_prompt, eos_autonomous_heal, ... |  |
|  |  +---------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------+  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                      HTTP Bridge (scripts/mcp-server-http.mjs)            |  |
|  |  - Listens on 127.0.0.1:3333 (or PORT env var)                            |  |
|  |  - Routes: GET /sse, POST /message, GET /health, GET /status              |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 2. ADR-036: Bi-Directional Model Context Protocol (MCP) Stream Server over SSE & Stdio

### Context

AI development tools (specifically Cursor and Google Antigravity) use the Model Context Protocol (MCP v2024-11-05). Connecting via stdio works well for single local subprocesses, but multi-agent pipelines, IDE web extensions, and live streaming environments require Server-Sent Events (SSE) with an HTTP POST `/message` back-channel.
Furthermore, operations like long-running fleet audits or benchmarks require the server to push real-time notifications (`notifications/progress`) down the open connection so clients display live progress indicators without timing out.

### Decision

1. **Zero External Dependency Implementation**:
   - Build `EosMcpStreamServer` using only Node.js standard library modules (`node:http`, `node:events`, `node:crypto`, `node:readline`).
   - Do not pull in heavy third-party MCP SDKs that introduce hundreds of transitive dependencies, preserving Layer-0 Hexagonal Purity (`dependencies: {}`).
2. **Session Lifecycle & SSE Protocol**:
   - `GET /sse`:
     - Responds with `200 OK`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
     - Generates cryptographically random UUID (`sessionId`).
     - Emits `event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`.
     - Instantiates an active session entry in `EosMcpSessionManager`.
     - Begins a 15-second heartbeat interval emitting `: keep-alive\n\n`.
   - `POST /message?sessionId=${sessionId}`:
     - Parses JSON-RPC 2.0 payload.
     - Validates session existence. If expired or missing, returns 400 with JSON-RPC error.
     - Dispatches request via `EosMcpServer`.
     - Sends response back both directly via HTTP response and streamed down the SSE socket via `event: message\ndata: ${JSON.stringify(response)}\n\n`.
   - Disconnect handling:
     - On `req.on("close")`, immediately cancels the keep-alive interval and removes the session from memory to prevent memory leaks.
3. **Bi-Directional Tool Handlers & Progress Streaming**:
   - Support streaming callback `onProgress?: (progress: number, total?: number, message?: string) => void` in tool execution.
   - For tools supporting multi-stage execution, emit MCP notification:
     `{ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken, progress, total, message } }`.
4. **Universal CLI Command (`bin/eos.mjs`)**:
   - `eos mcp --stdio`: Launches the stdin/stdout loop.
   - `eos mcp --sse [port]`: Spawns the HTTP SSE server listening on specified port (default: 3333).
   - `eos mcp status`: Prints supported capabilities, tool count, and active protocol version.

### Rejected Alternatives

- _Using `@modelcontextprotocol/sdk`_: Rejected because it introduces dozens of external npm packages (zod, express, cors, etc.), violating Inviolable Commandment V (Layer-0 Purity) and Nubank/Spotify zero-allocation constraints.
- _WebSockets (ws)_: Rejected because the official MCP specification mandates SSE + HTTP POST as the standard streaming transport, not raw WebSockets.

### Consequences

- **Positive**: 100% compliant with MCP v2024-11-05 specification; works out of the box with Cursor and Google Antigravity; 0 external runtime dependencies; zero memory leaks.
- **Negative / Trade-off**: Requires custom session management and SSE frame formatting in pure TypeScript, which requires strict unit test coverage for edge cases (premature socket closure, malformed JSON).

---

_Approved by Principal Architect: Valentín Flórez Arbeláez_
