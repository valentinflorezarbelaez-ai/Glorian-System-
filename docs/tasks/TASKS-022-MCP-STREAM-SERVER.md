# TASKS-022: BI-DIRECTIONAL MCP LIVE STREAM SERVER (SSE & STDIO) FOR CURSOR & ANTIGRAVITY

- **Task Package**: `TASKS-022`
- **Spec**: `SPEC-029-MCP-STREAM-SERVER`
- **Plan**: `PLAN-022`
- **Status**: `COMPLETED`

---

## Task DAG & Execution Sequence

```
[TASK-022-1: Core L0 MCP Stream Server (eosMcpStreamServer.ts)]
               |
               v
[TASK-022-2: Tool Enhancements & Async Progress in eosMcpServer.ts]
               |
               v
[TASK-022-3: HTTP SSE Bridge Server (scripts/mcp-server-http.mjs)]
               |
               v
[TASK-022-4: CLI Integration in bin/eos.mjs]
               |
               v
[TASK-022-5: Test Suite test/eosMcpStreamServer.test.mjs]
               |
               v
[TASK-022-6: CI/CD Pipeline Verification & Production Seal]
```

### Task Definitions

1. **TASK-022-1: Core L0 MCP Stream Server (`src/mcp/eosMcpStreamServer.ts`)**

   - Implement `EosMcpSessionManager` for storing active SSE client connections with `crypto.randomUUID()`, keepalive timers, and cleanup on disconnect.
   - Implement `EosMcpStreamServer` class handling native HTTP request routing (`GET /sse`, `POST /message`, `GET /health`, `GET /status`).
   - Implement SSE framing: `event: endpoint\ndata: ...\n\n`, `event: message\ndata: ...\n\n`, and `: keep-alive\n\n`.
   - Done criteria: 0 external dependencies, clean disconnection handling without unhandled rejections.

2. **TASK-022-2: Tool Enhancements & Async Progress in `src/mcp/eosMcpServer.ts`**

   - Add new/enhanced tools: `eos_query_topology`, `eos_wasm_compress`, `eos_audit_fleet`, and `eos_model_route`.
   - Support streaming progress callback `onProgress?: (progress: number, total?: number, message?: string) => void`.
   - Done criteria: Tools exposed in `tools/list` schema and callable synchronously or asynchronously.

3. **TASK-022-3: HTTP SSE Bridge Server (`scripts/mcp-server-http.mjs`)**

   - Integrate `EosMcpStreamServer` into `scripts/mcp-server-http.mjs`.
   - Support custom port via `process.env.PORT` (default 3333).
   - Done criteria: `node scripts/mcp-server-http.mjs` starts streaming server and logs endpoints.

4. **TASK-022-4: CLI Integration in `bin/eos.mjs`**

   - Support flags in `eos mcp`:
     - `eos mcp --stdio` (or `eos mcp stdio`): Default stdio mode for IDE direct process spawning.
     - `eos mcp --sse [port]` (or `eos mcp sse [port]`): Spawns the SSE HTTP streaming server.
     - `eos mcp status`: Displays MCP protocol version and active server capabilities.
   - Done criteria: CLI responds correctly to all subcommands.

5. **TASK-022-5: Test Suite (`test/eosMcpStreamServer.test.mjs`)**

   - Create unit tests covering:
     - SSE handshake and `endpoint` event generation.
     - Keep-alive heartbeat comments.
     - Sending JSON-RPC `tools/list` and `tools/call` over POST `/message` with SSE stream delivery.
     - Stdio message parsing and error isolation.
     - Client disconnect cleanup.
   - Done criteria: All test cases pass with exit code 0.

6. **TASK-022-6: CI/CD Pipeline Verification & Production Seal**
   - Register `test/eosMcpStreamServer.test.mjs` in `scripts/verify-cicd-pipeline.mjs` Stage 4 test runner.
   - Update `IMPLEMENTATION_AUTHORIZATION.md` and `AGENTS.md` spec counter.
   - Run `npm test` and `npm run verify:strict`.
   - Done criteria: 100% test pass, exit code 0 across all 7 stages.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
