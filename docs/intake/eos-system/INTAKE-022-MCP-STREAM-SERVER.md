# INTAKE-022: BI-DIRECTIONAL MCP LIVE STREAM SERVER (SSE & STDIO) FOR CURSOR & ANTIGRAVITY

- **Intake ID**: `INTAKE-022`
- **Project**: `EOS System (Engineering Operating System)`
- **Target Specification**: `SPEC-029-MCP-STREAM-SERVER`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-10-25

---

## 1. Context & Business Need

EOS System provides an extensive suite of high-performance engineering tools (Triple-Modular Redundancy, AST context compression, semantic code graph blast radius, autonomous self-healing, BS.1770 audio normalization, and WASM topology analysis). Modern AI IDEs—principally **Cursor** and **Google Antigravity**—rely on the open **Model Context Protocol (MCP)** specification (v2024-11-05) to discover, inspect, and execute workspace tools.

To support seamless integration with these IDEs, the system requires:

1. **Server-Sent Events (SSE) Live Streaming**: A persistent `/sse` transport where the server assigns a unique `sessionId`, issues `endpoint` events, and streams real-time tool execution progress (`notifications/progress`), heartbeat keep-alives, and asynchronous responses.
2. **Bi-Directional Streaming & Progress Notifications**: For long-running operations (such as multi-repo fleet audits, 100,000-iteration WASM benchmarks, and AST outline compression), the server must stream incremental progress without blocking the client or triggering timeouts.
3. **Session Lifecycle & Clean Disconnect Management**: Robust in-memory tracking of active SSE client sessions, thread-safe message dispatching, and zero-leak cleanup upon client disconnect.
4. **Universal CLI & HTTP Invocation**: First-class support in `bin/eos.mjs` for `eos mcp --stdio` and `eos mcp --sse [port]` with zero external npm dependencies.

## 2. Stakeholder Goals & Invariants

1. **Full Protocol Conformance (MCP 2024-11-05)**: Full compliance with JSON-RPC 2.0 specifications over both `stdio` and `SSE + POST /message?sessionId=<id>`.
2. **Layer-0 Purity & Zero Dependencies**: 100% native Node.js (`node:http`, `node:events`, `node:crypto`, `node:readline`). No express, ws, or third-party frameworks.
3. **Bi-Directional Stream Delivery**:
   - `GET /sse` opens an event stream with headers `text/event-stream`, `no-cache`, and `keep-alive`.
   - Sends `event: endpoint\ndata: /message?sessionId=<sessionId>\n\n`.
   - Client sends JSON-RPC requests via `POST /message?sessionId=<sessionId>`.
   - Responses and progress notifications are pushed down the SSE connection (`event: message`).
4. **Resilient Session Management**: Unique cryptographically secure session IDs (`crypto.randomUUID()`), keepalive ping every 15 seconds, and automatic subscriber cleanup on connection close.
5. **Verification & Testing**: Comprehensive unit tests covering session creation, message routing, tool invocation over SSE, stdio framing, and error handling with exit code 0 across all 7 CI/CD stages.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
