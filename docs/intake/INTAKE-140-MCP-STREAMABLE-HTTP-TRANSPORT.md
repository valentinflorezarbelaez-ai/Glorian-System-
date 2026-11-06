# INTAKE-140: Modern MCP Streamable HTTP Transport & Architectural Split

## 1. Context & Business Intent
- **Initiative**: Glorian System (EOS Control Plane) — Horizon 2, Engine 3.
- **Requester**: Principal Architect & System Owner (Valentín Flórez Arbeláez).
- **Date**: 2026-11-03.
- **Status**: `INTAKE_APPROVED`.

### Problem Statement
The current MCP communication surface in Glorian System suffers from architectural divergence:
1. `api/mcp.js` (deployed serverless on Vercel) exposes a legacy JSON-RPC endpoint limited to 6 read-only tools, permissive wildcard CORS (`Access-Control-Allow-Origin: *`), and lacks support for modern streaming and tool verification.
2. `src/mcp/eosMcpStreamServer.ts` relies on the deprecated MCP HTTP+SSE pattern (`GET /sse` + `POST /message?sessionId=...`), which was formally replaced by the Model Context Protocol Streamable HTTP transport standard.
3. Attempting to unify serverless (Vercel) and long-lived local processes under the exact same stateful session mechanics creates fragility: Vercel functions are stateless and ephemeral, whereas local agent sessions (Cursor, Claude Code, Antigravity) require persistent streamable channels with robust eviction and replay semantics.

### Strategic Objective
Modernize Glorian's Model Context Protocol implementation into a dual-model, fail-closed Streamable HTTP transport adhering strictly to Layer-0 purity (`runtimeDependenciesCount: 0`):
- **Serverless Edge (`api/mcp.js`)**: Pure stateless JSON-RPC over `POST /api/mcp`, strict Origin/Host validation, bounded payloads (1 MiB), and structured tool execution (including `eos_slsa_provenance_sbom` in verify mode).
- **Persistent Local Server (`src/mcp/eosMcpStreamServer.ts`)**: Complete Streamable HTTP implementation supporting dual `application/json` and `text/event-stream` responses, 256-bit CSPRNG `MCP-Session-Id` bound to token hash, LRU session eviction (cap 16), bounded event ring buffer (max 100 events / 512 KiB) for `Last-Event-ID` resumption, and explicit protocol version negotiation (`2025-03-26`, `2025-06-18`, and `2024-11-05` compat).

---

## 2. Inviolable Constitutional Constraints
- **Law I (Specification as Supreme Truth)**: Zero code without approved EARS requirements and Gherkin BDD scenarios.
- **Law II (Strict Gate)**: Level 3 implementation authorization mandatory before touching production files.
- **Law III (Evidence Over Claims)**: Deterministic verification receipts (`EVD-SPEC-140.json`) with exit code 0.
- **Law V (Layer-0 Pure Purity)**: Exactly 0 runtime npm dependencies (`package.json` -> `dependencies: {}`). 100% native Node.js (`node:http`, `node:crypto`, `node:stream`).
- **Law VI (Zero Plain Secrets & DNS Rebinding Protection)**: Eradicate `Access-Control-Allow-Origin: *`, validate `Origin` and `Host` headers, and verify bearer tokens in constant time with `crypto.timingSafeEqual()`.
