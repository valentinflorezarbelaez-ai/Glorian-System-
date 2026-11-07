# CHANGE-022: BI-DIRECTIONAL MCP LIVE STREAM SERVER (SSE & STDIO) FOR CURSOR & ANTIGRAVITY

- **Change ID**: `CHANGE-022`
- **Specification**: `SPEC-029-MCP-STREAM-SERVER`
- **Plan**: `PLAN-022`
- **Date**: 2026-10-25
- **Author**: Valentín Flórez Arbeláez
- **Status**: `PROPOSED`

---

## 1. Summary of Changes

1. **Core TypeScript MCP Stream Server (`src/mcp/eosMcpStreamServer.ts`)**:
   - Implement `EosMcpStreamServer` providing native HTTP and SSE transports with zero external dependencies.
   - Implement `EosMcpSessionManager` tracking active client sessions, keep-alive timers, and bi-directional message routing.
   - Handle `GET /sse` with proper streaming headers (`text/event-stream`), initial `endpoint` event generation, and periodic keep-alive pings (`: keep-alive\n\n`).
   - Handle `POST /message?sessionId=<id>` for incoming JSON-RPC 2.0 requests, returning responses either synchronously or pushed down the SSE stream.
   - Support streaming `notifications/progress` during long-running tool executions.
2. **Native Tool Expansions in `src/mcp/eosMcpServer.ts`**:
   - Extend `EosMcpServer` to expose high-value fleet tools: `eos_query_topology`, `eos_wasm_compress`, `eos_audit_fleet`, and `eos_model_route`.
   - Implement async dispatching with optional progress callback hook for live streaming.
3. **HTTP Server Script Refactoring (`scripts/mcp-server-http.mjs`)**:
   - Integrate `EosMcpStreamServer` directly into `scripts/mcp-server-http.mjs` supporting standalone local execution on port 3333 (or `process.env.PORT`).
   - Expose endpoints: `GET /sse`, `POST /message`, `GET /health`, and `GET /status`.
4. **Universal CLI Enhancement (`bin/eos.mjs`)**:
   - Extend `eos mcp` command:
     - `eos mcp --stdio`: Runs MCP over standard I/O for Cursor/Antigravity local subprocess integration.
     - `eos mcp --sse [port]`: Spawns the live SSE HTTP streaming daemon.
     - `eos mcp status`: Informs on MCP capabilities and registered tools.
5. **Automated Verification & Tests**:
   - Create `test/eosMcpStreamServer.test.mjs` verifying SSE handshake, session management, JSON-RPC message delivery, progress streaming, and stdio framing.
   - Register `test/eosMcpStreamServer.test.mjs` in `scripts/verify-cicd-pipeline.mjs` Stage 4 test suite.
   - Execute and verify all 7 stages pass with exit code 0.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
