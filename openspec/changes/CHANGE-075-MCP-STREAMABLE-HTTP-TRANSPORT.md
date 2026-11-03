# CHANGE-075: Modern MCP Streamable HTTP Transport & Architectural Split

## 1. Metadata
- **Change ID**: `CHANGE-075`
- **Spec Target**: `SPEC-140`
- **Related Specs**: `SPEC-027`, `SPEC-061`, `SPEC-096`, `SPEC-138`, `SPEC-139`
- **Architectural Decisions**: `ADR-0172`, `ADR-0173`
- **State**: `PROPOSED`

---

## 2. Intent & Scope
1. **Refactor `src/mcp/eosMcpStreamServer.ts`**:
   - Modernize from legacy `GET /sse` + `POST /message` to Streamable HTTP on a unified path (`/api/mcp` or `/mcp`).
   - Implement `MCP-Protocol-Version` negotiation (`2025-03-26`, `2025-06-18`, `2024-11-05`).
   - Generate `MCP-Session-Id` using 256-bit CSPRNG, internally bound to client token hash.
   - Enforce LRU session eviction when active sessions exceed capacity (default 16).
   - Implement bounded per-session event ring buffer (max 100 events / 512 KiB) with `Last-Event-ID` resumption.
   - Enforce constant-time token comparison with `crypto.timingSafeEqual()`.
   - Implement 1 MiB hard payload bound with immediate socket destruction on overflow (`HTTP 413`).
   - Mitigate DNS Rebinding with strict `Origin` and `Host` validation (`HTTP 403`).

2. **Refactor `api/mcp.js` (Serverless Edge on Vercel)**:
   - Enforce stateless JSON-RPC mode: no in-memory session leakage across ephemeral lambdas (`ADR-0172`).
   - Eliminate wildcard `Access-Control-Allow-Origin: *`.
   - Expand allowlist to include `eos_slsa_provenance_sbom` (`mode: "verify"` and `"both"`).
   - Handle read-only filesystem environments safely with structured JSON-RPC errors.

3. **Author Adversarial Test Suite `test/eosMcpStreamableHttp.test.mjs`**:
   - Verify `BDD-372` to `BDD-376`.

---

## 3. Impact Assessment
- Zero modifications to `package.json` runtime dependencies (`dependencies: {}` preserved).
- Full backward compatibility for clients expecting JSON-RPC 2.0.
- Safe integration with CI/CD 7-stage verification gate.
