# SPEC-144: MCP Streamable HTTP Lifecycle & Preemptive Wasm Worker Hardening

## 1. Specification Metadata
- **Specification ID**: `SPEC-144`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`, `SPEC-143`
- **Architectural Decisions**:
  - `ADR-0181`: Inconditional Preemptive Worker Thread Isolation & Size Bounding for Arbitrary WebAssembly Bytecode
  - `ADR-0182`: Streamable HTTP Session Lifecycle, Local Reference Teardown, Output Stream Disconnect & Activity Renewal
  - `ADR-0183`: Backpressure Signalling via Dropped Event Sequence Auditing, Gap Frames & Graceful Shutdown
- **Module Target**: `src/mcp/eosMcpServer.ts`, `src/mcp/eosMcpStreamServer.ts`, `src/core/eosWasmSandboxEngine.ts`, `test/eosStreamWasmHardening.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-420 (Event-Driven / Inconditional Preemptive WebAssembly Worker Isolation)**:
  `WHEN an agent executes WebAssembly bytecode containing arbitrary external code (Boolean(args?.code)) or loops, THE SYSTEM SHALL execute the bytecode in a dedicated node:worker_threads.Worker regardless of caller-supplied worker flags, AND IF execution exceeds timeoutMs, THEN THE SYSTEM SHALL terminate the worker thread preemptively via worker.terminate(), returning status TIMEOUT_KILLED without blocking or starving the host Node.js event loop.`

- **FR-421 (Unwanted Condition / Pre-Spawn Bytecode Payload Size Verification)**:
  `IF a caller supplies WebAssembly bytecode in Base64 exceeding 512 KiB (524,288 bytes), THEN THE SYSTEM SHALL reject the request immediately with a JSON-RPC -32602 validation error before instantiating or spawning any Worker thread.`

- **FR-422 (Ubiquitous / Permanent — Worker Cleanup Guarantee & Concurrency Bounding)**:
  `THE SYSTEM SHALL ensure that any spawned Worker thread is unconditionally terminated via worker.terminate() in a try-finally block across all exit conditions (success, execution trap, compilation failure, or timeout), AND SHALL throttle concurrent active workers to a maximum threshold of 8 to prevent OS thread exhaustion.`

- **FR-423 (State-Driven / Hermetic Socket Lifecycle and Idempotent Session Teardown)**:
  `WHILE closing a StreamableSession via close(reason), THE SYSTEM SHALL capture a local reference to activeResponse, emit an SSE frame with event: session_closing and reason metadata if writable, invoke res.end(), execute detachResponse(), and mark the session closed idempotently so subsequent concurrent invocations return immediately without reentrant operations.`

- **FR-424 (Event-Driven / Response Stream Termination Event Binding)**:
  `WHEN an HTTP GET /api/mcp client attaches to a server stream, THE SYSTEM SHALL attach disconnect cleanup listeners strictly to res.on("close") and res.on("error"), ensuring that the SSE channel is not prematurely detached upon incoming request header consumption.`

- **FR-425 (Ubiquitous / Permanent — Activity Renewal on SSE Keep-Alive Heartbeats)**:
  `THE SYSTEM SHALL update this.lastActivity = Date.now() upon each successful transmission of an SSE keep-alive heartbeat (: keep-alive\n\n), preventing long-lived healthy read-only notification streams from being falsely evicted by the 15-minute TTL idle session reaper.`

- **FR-426 (Ubiquitous / Permanent — Auditable Backpressure & Sequence Gap Signalling)**:
  `THE SYSTEM SHALL increment droppedEventsCount whenever the bounded ring buffer exceeds its maximum capacity (100 events) and shifts the oldest record, AND SHALL provide sequence gap awareness when an evicted Last-Event-ID is requested by a reconnecting client.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-398 Aislamiento Forzoso en Worker de Todo Bytecode Wasm Arbitrario (args.code)
  GIVEN el servidor MCP local autenticado con la herramienta eos_wasm_sandbox
  WHEN un cliente invoca la herramienta con bytecode Base64 arbitrario que contiene un bucle infinito ("(loop (br 0))") sin especificar worker: true ni template: "LOOP"
  THEN el servidor despacha incondicionalmente la ejecución a través de executeWasmWorker con un timeoutMs estricto
  AND el worker es terminado por el anfitrión mediante worker.terminate()
  AND la respuesta retorna en menos de 1000ms con status "TIMEOUT_KILLED" y exitCode: 1
  AND el event loop del anfitrión permanece 100% operativo y receptivo a peticiones concurrentes

SCENARIO: BDD-399 Cierre Grácil de Sockets, Emisión de session_closing e Idempotencia en close()
  GIVEN una sesión StreamableSession con una respuesta HTTP activa vinculada
  WHEN se invoca session.close("SESSION_TERMINATED") repetidamente de manera concurrente
  THEN la respuesta HTTP activa recibe una trama SSE "event: session_closing" con la razón y sessionId
  AND el socket de respuesta ejecuta res.end() quedando en estado res.writableEnded === true
  AND los temporizadores de latido son cancelados deterministamente
  AND las invocaciones subsecuentes a close() no duplican llamadas a res.end() ni corrompen el estado interno

SCENARIO: BDD-400 Desconexión SSE Enlazada Estrictamente a res.on("close")
  GIVEN un servidor EosMcpStreamServer escuchando en un puerto local y un cliente conectado a GET /api/mcp
  WHEN el cliente completa el envío de cabeceras HTTP GET pero mantiene el socket TCP de recepción abierto
  THEN la sesión permanece acoplada y activa en el servidor sin desacoplarse prematuramente
  WHEN el cliente aborta o cierra la conexión TCP de recepción
  THEN el evento res.on("close") dispara el desacople de la sesión liberando activeResponse de forma limpia

SCENARIO: BDD-401 Preservación de Sesiones Solo-Lectura mediante Renovación de TTL en Heartbeats
  GIVEN una sesión StreamableSession activa conectada a un stream de eventos SSE
  WHEN transcurre un período donde el cliente solo recibe latidos periódicos sendHeartbeat() sin enviar nuevos comandos POST
  THEN cada latido exitoso actualiza this.lastActivity al timestamp actual
  AND la sesión no es purgada como inactiva por reapIdleSessions() mientras el stream permanezca abierto

SCENARIO: BDD-402 Notificación Grácil de Cierre en Shutdown y Auditoría de Descarte de Eventos
  GIVEN un servidor EosMcpStreamServer con múltiples sesiones de stream activas
  WHEN el servidor ejecuta close() por parada del proceso (SIGTERM/shutdown)
  THEN todas las sesiones activas reciben la trama SSE "event: session_closing" con reason: "SERVER_SHUTDOWN"
  AND todas las respuestas HTTP son finalizadas deterministamente antes del cierre del socket servidor
  AND el contador droppedEventsCount audita con precisión el número de eventos descartados por desborde del ring buffer

SCENARIO: BDD-403 Terminación Estricta de Workers y Rechazo de Bytecode Sobredimensionado
  GIVEN la herramienta eos_wasm_sandbox
  WHEN un cliente envía un payload de bytecode Base64 que excede los 512 KiB
  THEN el servidor rechaza la solicitud de inmediato con error JSON-RPC -32602 sin crear ningún hilo Worker
  WHEN se ejecuta bytecode válido (operación aritmética o trampa OOB)
  THEN el Worker Thread finaliza y es terminado explícitamente en el bloque finally sin dejar hilos huérfanos
```
