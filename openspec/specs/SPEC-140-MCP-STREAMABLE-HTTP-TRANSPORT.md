# SPEC-140: Modern MCP Streamable HTTP Transport & Architectural Split

## 1. Specification Metadata
- **Specification ID**: `SPEC-140`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-027`, `SPEC-061`, `SPEC-096`, `SPEC-138`, `SPEC-139`
- **Architectural Decisions**: `ADR-0172` (Serverless Stateless vs Local Stateful Split), `ADR-0173` (MCP Protocol Version Negotiation)
- **Module Target**: `src/mcp/eosMcpStreamServer.ts`, `api/mcp.js`, `test/eosMcpStreamableHttp.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-01 (Ubiquitous / Permanent — Unified Endpoint & Dual Negotiation)**:
  `THE SYSTEM SHALL expose a unified HTTP entrypoint accepting POST requests for JSON-RPC 2.0 messages, responding with application/json for immediate execution or streaming Server-Sent Events (SSE) when Accept: text/event-stream is negotiated.`

- **FR-02 (State-Driven / Protocol Version Negotiation)**:
  `WHILE negotiating incoming MCP requests, THE SYSTEM SHALL validate the MCP-Protocol-Version header, supporting 2025-03-26, 2025-06-18, and 2024-11-05 (compat), and aborting unsupported versions with HTTP 400 Bad Request.`

- **FR-03 (State-Driven / Session Security & Timing-Safe Verification)**:
  `WHILE authenticating client connections, THE SYSTEM SHALL verify Bearer tokens using constant-time comparison (crypto.timingSafeEqual), generate 256-bit CSPRNG MCP-Session-Id tokens, and bind each session to the SHA-256 hash of its authenticating token.`

- **FR-04 (Error / Capacity Condition — LRU Session Eviction)**:
  `IF active sessions reach maximum capacity (default 16), THEN THE SYSTEM SHALL evict the least recently used (LRU) session and return HTTP 404 with a re-initialization requirement upon any subsequent request referencing the evicted session.`

- **FR-05 (Event-Driven / Resilient Event Replay)**:
  `WHEN a disconnected client reconnects supplying a valid Last-Event-ID within the bounded ring buffer (100 events / 512 KiB max), THE SYSTEM SHALL retransmit unacknowledged events in monotonic order; IF the Last-Event-ID does not exist in the buffer, THEN THE SYSTEM SHALL return HTTP 400 without silent stream restarts.`

- **FR-06 (Error / Unwanted Condition — DNS Rebinding & Payload Overflow)**:
  `IF the incoming request body exceeds 1,048,576 bytes (1 MiB), or the Origin / Host headers fail allowlist validation, THEN THE SYSTEM SHALL destroy the incoming socket stream immediately and abort with HTTP 413 Payload Too Large or HTTP 403 Forbidden.`

- **FR-07 (Ubiquitous / Permanent — Serverless Stateless Edge Purity)**:
  `THE SYSTEM SHALL operate api/mcp.js on Vercel strictly in stateless JSON mode without in-memory session leakage, returning structured errors without throwing if underlying files are read-only or absent.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-372 Negociación Dual JSON y SSE en Endpoint Unificado
  GIVEN un servidor MCP Streamable HTTP en ejecución local
  WHEN un cliente envía un POST con JSON-RPC call_tool para eos_slsa_provenance_sbom
  AND el header Accept es application/json
  THEN el servidor retorna HTTP 200 con application/json conteniendo el resultado de verificación
  WHEN otro cliente envía un POST con Accept: text/event-stream
  THEN el servidor inicia un stream SSE con Content-Type: text/event-stream y emite eventos enmarcados

SCENARIO: BDD-373 Unión Criptográfica de Sesión y Evicción LRU
  GIVEN un servidor con capacidad máxima de 16 sesiones
  WHEN se abre una sesión S con Bearer token A
  AND un atacante intenta utilizar la sesión S con Bearer token B
  THEN el servidor rechaza la petición con HTTP 404 exigiendo reinicialización
  WHEN se abren 17 sesiones consecutivas
  THEN la primera sesión se evicta automáticamente y su siguiente uso devuelve HTTP 404

SCENARIO: BDD-374 Reanudación Resiliente con Last-Event-ID y Control de Versión
  GIVEN un cliente desconectado de una sesión activa con eventos almacenados en el buffer
  WHEN el cliente reconecta enviando Last-Event-ID válido
  THEN el servidor retransmite los eventos posteriores sin duplicar efectos secundarios
  WHEN el cliente envía un Last-Event-ID inexistente o forjado
  THEN el servidor responde HTTP 400 Bad Request
  WHEN un cliente envía un header MCP-Protocol-Version no soportado (ej. 1999-01-01)
  THEN el servidor responde HTTP 400 Bad Request

SCENARIO: BDD-375 Rechazo Fail-Closed de DNS Rebinding y Payloads Mayores a 1 MiB
  GIVEN el endpoint MCP Streamable HTTP
  WHEN se envía una solicitud con tamaño de cuerpo superior a 1,048,576 bytes
  THEN el servidor corta el stream de inmediato con HTTP 413 Payload Too Large
  WHEN se envía una solicitud con header Origin no autorizado
  THEN el servidor rechaza la conexión con HTTP 403 Forbidden antes de parsear el JSON

SCENARIO: BDD-376 Modo Serverless Sin Estado en api/mcp.js
  GIVEN el handler serverless api/mcp.js en Vercel
  WHEN recibe una solicitud con Accept: text/event-stream
  THEN responde con JSON síncrono estructurado o código 406 sin retener sesiones en memoria
  AND ejecuta herramientas de solo lectura y verificación sin lanzar excepciones
```

---

## 4. Invariants & Non-Functional Requirements
- **NFR-01 (Layer-0 Pure Standard)**: 0 external runtime npm dependencies (`package.json` -> `dependencies: {}`).
- **NFR-02 (Memory Safety)**: Hard limit of 100 events / 512 KiB per session ring buffer; maximum 16 active sessions.
- **NFR-03 (Timing Attack Immune)**: All bearer tokens and signatures validated via `crypto.timingSafeEqual()`.
