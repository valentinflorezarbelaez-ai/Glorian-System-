# PLAN-140: Architecture Plan — Modern MCP Streamable HTTP Transport

## 1. Architectural Decisions (ADR)

### ADR-0172: Architectural Split Between Serverless Edge (Vercel) and Local Persistent Server
- **Context**: Vercel serverless functions (`api/mcp.js`) are ephemeral, stateless lambdas with strict `maxDuration` limits, read-only file systems, and zero guaranteed shared memory across concurrent requests. Local servers (`src/mcp/eosMcpStreamServer.ts`), conversely, are long-lived Node.js daemons running directly on host machines where agents like Cursor, Claude Code, and Antigravity connect.
- **Decision**: Architect a strict decoupling:
  1. `api/mcp.js` (Serverless Edge) operates strictly in **stateless mode**: immediate JSON-RPC resolution, no in-memory session mapping, no long-lived SSE streaming, and structured errors on file system writes.
  2. `src/mcp/eosMcpStreamServer.ts` (Local Engine) implements the **full stateful Streamable HTTP transport**: 256-bit CSPRNG `MCP-Session-Id`, bounded LRU session eviction, bounded event replay ring buffer for `Last-Event-ID`, and dual JSON/SSE streaming.
- **Consequences**:
  - Positive: Eradicates memory leaks and broken streaming assumptions on serverless infrastructure.
  - Positive: Guarantees high-performance resilient streaming on developer machines and persistent daemons.
  - Negative: Requires clients connecting to Vercel to use synchronous request/response patterns.

### ADR-0173: Supported MCP Protocol Versions & Negotiation
- **Context**: The Model Context Protocol specification evolved from the legacy HTTP+SSE draft (`2024-11-05`) into the Streamable HTTP standard (`2025-03-26` and `2025-06-18`).
- **Decision**: Validate the `MCP-Protocol-Version` HTTP header upon every incoming request. The server explicitly supports:
  - `2025-06-18` (Primary modern standard)
  - `2025-03-26` (Streamable HTTP baseline)
  - `2024-11-05` (Backward compatibility mode for legacy agent clients)
  Any version not in this set is rejected with `HTTP 400 Bad Request`.
- **Consequences**:
  - Positive: Explicit contract negotiation preventing subtle protocol drifts.
  - Positive: Seamless interoperability with both legacy and bleeding-edge MCP clients.

---

## 2. Component Layout & Responsibilities

| Component | Target File | Responsibility |
|---|---|---|
| Stream Server Engine | `src/mcp/eosMcpStreamServer.ts` | Complete Streamable HTTP daemon, LRU session management, ring buffer replay |
| Serverless Handler | `api/mcp.js` | Stateless JSON-RPC serverless endpoint, Origin validation, 1 MiB bound |
| Adversarial Test Suite | `test/eosMcpStreamableHttp.test.mjs` | BDD-372 to BDD-376 adversarial protocol verification |
| Verification Receipt | `docs/evidence/EVD-SPEC-140.json` | Sealed execution receipt upon 7-stage CI gate passing |
