# SPEC-143: Engineering Ground Truth, Preemptive Sandbox Isolation & Attack Surface Hardening

## 1. Specification Metadata
- **Specification ID**: `SPEC-143`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`
- **Architectural Decisions**: `ADR-0178` (Public Serverless Tool Gating & Execution Barrier), `ADR-0179` (Preemptive Worker Thread Isolation for Wasm Execution Deadlines), `ADR-0180` (Epistemic Ground Truth & Nominal Honesty for Layer-0 Lexical-Hash Vector Projections)
- **Module Target**: `api/mcp.js`, `src/core/eosWasmSandboxEngine.ts`, `src/core/eosHybridKnowledgeEngine.ts`, `src/mcp/eosMcpServer.ts`, `src/mcp/eosMcpStreamServer.ts`, `docs/contracts/mcp-tool-catalog.json`, `test/eosGroundTruthHardening.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-415 (Unwanted Condition / Error — Public Serverless Compute Attack Surface Elimination)**:
  `IF a request is received on the public unauthenticated serverless endpoint (api/mcp.js) attempting to invoke eos_wasm_sandbox or any arbitrary code execution tool, THEN THE SYSTEM SHALL reject the request immediately with a fail-closed 404/403 RPC error, restricting execution sandboxes to authenticated persistent environments or authenticated tokens.`

- **FR-416 (Event-Driven / Preemptive WebAssembly Worker Isolation with Timeout Kill)**:
  `WHEN an agent executes WebAssembly bytecode with a designated timeoutMs (or requests async execution), THE SYSTEM SHALL isolate the instance inside a dedicated node:worker_threads.Worker, and IF execution exceeds timeoutMs, THEN THE SYSTEM SHALL terminate the worker thread preemptively via worker.terminate(), returning status TIMEOUT_KILLED without blocking or hanging the host Node.js event loop.`

- **FR-417 (Ubiquitous / Permanent — Epistemic Ground Truth & Nominal Honesty for Hybrid Search)**:
  `THE SYSTEM SHALL plainly and unambiguously document the exact mathematical nature of eos_semantic_search across contracts, interfaces, and MCP schemas as a deterministic Layer-0 Hybrid Lexical-Vector Search (fusing SQLite FTS5 BM25 with a 64-dimensional FNV-1a subword n-gram hash projection via RRF k=60), explicitly documenting that it operates without external neural transformer weights or semantic embeddings.`

- **FR-418 (State-Driven / Automated Lazy Corpus Indexing Bootstrapping)**:
  `WHILE the MCP server is initialized or when eos_semantic_search is queried with an empty document index (count == 0), THE SYSTEM SHALL automatically trigger an incremental corpus indexing cycle (indexing openspec/specs, openspec/changes, docs/plans, and src/core) to ensure instant search responsiveness out-of-the-box.`

- **FR-419 (Ubiquitous / Permanent — Streamable HTTP Transport Session Lifecycle & Heartbeat Resilience)**:
  `THE SYSTEM SHALL automatically evict idle streamable sessions exceeding 15 minutes of inactivity via a periodic TTL reaper, and SHALL emit periodic keep-alive comments (: keep-alive\n\n) every 15 seconds across active GET /api/mcp SSE streams to prevent intermediate proxy dropouts, tearing down timers cleanly on socket termination.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-393 Eliminación de Superficie de Ataque Público en api/mcp.js
  GIVEN el endpoint serverless público no autenticado en api/mcp.js
  WHEN un cliente remoto envía una solicitud tools/call para eos_wasm_sandbox
  THEN el endpoint rechaza la llamada con código de error JSON-RPC -32601 ("Tool is not exposed by the read-only HTTP MCP endpoint")
  AND ninguna instancia de WebAssembly ni de node:vm es creada en el entorno serverless
  AND la lista devuelta por tools/list omite eos_wasm_sandbox para clientes públicos

SCENARIO: BDD-394 Aislamiento Preemptivo de Bytecode WebAssembly en Hilos Worker con Interrupción por Timeout
  GIVEN un módulo de bytecode WebAssembly compilado con un bucle infinito ("(loop (br 0))")
  WHEN se ejecuta en el motor de sandboxing mediante executeWasmWorker con un timeoutMs de 100 milisegundos
  THEN el hilo worker es terminado de forma preemptiva por el anfitrión mediante worker.terminate()
  AND la ejecución retorna en menos de 1000 milisegundos con status: "TIMEOUT_KILLED" y exitCode: 1
  AND el event loop del proceso anfitrión permanece completamente desbloqueado y receptivo

SCENARIO: BDD-395 Veracidad Epistémica y Honestidad Nominal en Búsqueda Híbrida Lexical-Hash (eos_semantic_search)
  GIVEN el catálogo de herramientas MCP y el esquema de eos_semantic_search
  WHEN se inspecciona la documentación técnica, metadatos y tool descriptor
  THEN el sistema describe explícitamente el algoritmo como FTS5 BM25 léxico fusionado con proyección hash de 64 dimensiones (RRF k=60)
  AND aclara expresamente la ausencia de pesos neuronales externos o transformers
  AND conserva pureza Layer-0 absoluta con cero dependencias npm de runtime

SCENARIO: BDD-396 Indexación Automática y Perezosa del Corpus Arquitectónico en el Arranque del Servidor MCP
  GIVEN una base de datos SQLite vectorial recién inicializada sin documentos indexados
  WHEN un cliente ejecuta una consulta de búsqueda mediante eos_semantic_search o se solicita ensureCorpusIndexed()
  THEN el motor indexa automáticamente las OpenSpecs, Changes y Planes del repositorio
  AND retorna coincidencias relevantes con snippets, rutas y clasificaciones de categoría
  AND las consultas subsecuentes son resueltas en < 10 milisegundos

SCENARIO: BDD-397 Robustecimiento de Transporte MCP Streamable HTTP (Cosecha TTL de Sesiones Inactivas y Latidos Heartbeat SSE)
  GIVEN el servidor de transporte Streamable HTTP (eosMcpStreamServer.ts)
  WHEN una sesión permanece inactiva por más de su ventana TTL o un cliente mantiene abierto un canal GET /api/mcp
  THEN el recolector reaper desaloja la sesión inactiva liberando recursos de memoria
  AND el canal SSE activo recibe pulsos periódicos de latido ": keep-alive\n\n"
  AND la desconexión del cliente libera inmediatamente los listeners y temporizadores
```
