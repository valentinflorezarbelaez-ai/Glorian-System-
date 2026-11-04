# SPEC-142: Capability-Based Wasm & MicroVM Agent Sandboxing Engine (Big Tech Standard)

## 1. Specification Metadata
- **Specification ID**: `SPEC-142`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-054`, `SPEC-073`, `SPEC-081`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`
- **Architectural Decisions**: `ADR-0176` (Capability-Based WebAssembly & MicroVM Agent Sandboxing Architecture), `ADR-0177` (Zero-Cold-Start Dual-Tier Isolation)
- **Module Target**: `src/core/eosWasmSandboxEngine.ts`, `src/mcp/eosMcpServer.ts`, `api/mcp.js`, `test/eosWasmSandboxEngine.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-01 (Ubiquitous / Permanent — Pure Layer-0 Wasm Sandboxing with Bounded Linear Memory)**:
  `THE SYSTEM SHALL instantiate and execute WebAssembly bytecode sandboxes using native WebAssembly.Instance with linear memory bounded strictly between 1 page (64 KiB) and 256 pages (16 MiB), without external runtime npm dependencies.`

- **FR-02 (State-Driven / Capability-Based Host Import Quarantine)**:
  `WHILE executing guest sandboxed modules, THE SYSTEM SHALL deny ambient access to host filesystem, network sockets, environment variables, and process spawning, exposing only explicit deterministic host functions (host_log, host_sha256, host_time_ns).`

- **FR-03 (Error / Unwanted Condition — Deterministic Trap Interception & Out-of-Bounds Containment)**:
  `IF a sandboxed module attempts an out-of-bounds memory access, executes an unreachable opcode, or exceeds its execution memory/time budget, THEN THE SYSTEM SHALL intercept the trap immediately, terminate the guest sandbox, and return a structured TRAPPED_OOB or TIMEOUT_KILLED status without terminating or corrupting the parent host process.`

- **FR-04 (Event-Driven / Hermetic JavaScript Isolate Fallback)**:
  `WHEN an agent requests execution of prospective JavaScript/TypeScript code instead of raw Wasm bytecode, THE SYSTEM SHALL execute the code inside a hermetically isolated node:vm context with frozen intrinsics, bounded execution timeout (default 2000ms), and zero ambient process/require access.`

- **FR-05 (Event-Driven / Cryptographic Execution Receipt & Ledger Sealing)**:
  `WHEN any sandbox execution terminates (whether nominal or faulted), THE SYSTEM SHALL compute a deterministic execution receipt containing executionId, inputSha256, outputSha256, durationNs, and memoryConsumedBytes, and record the attestation into the durable SQLite WAL ledger.`

- **FR-06 (Ubiquitous / Permanent — Multi-Channel MCP & Serverless Tool Integration)**:
  `THE SYSTEM SHALL expose the capability-based sandboxing engine via the eos_wasm_sandbox MCP tool in both local persistent daemon and Vercel serverless edge environments, validating all inputs and enforcing a 256 KiB code payload ceiling.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-382 Instanciación y Ejecución de Bytecode WebAssembly en < 1ms
  GIVEN un módulo de bytecode WebAssembly válido (suma aritmética o transformación de memoria)
  WHEN el motor ejecuta el módulo en Tier WASM con memoria inicial de 1 página (64 KiB)
  THEN la ejecución completa en menos de 1 milisegundo (< 1000 µs)
  AND el resultado numérico es matemáticamente exacto
  AND el estado de salida es COMPLETED con código de salida 0

SCENARIO: BDD-383 Aislamiento de Memoria y Captura de Trampas Fuera de Límites
  GIVEN un módulo WebAssembly que intenta leer o escribir más allá del límite de páginas asignadas
  WHEN el módulo se ejecuta dentro del sandbox
  THEN el motor captura la trampa (RuntimeError) sin abortar el proceso principal de Node.js
  AND el resultado reporta status: "TRAPPED_OOB"
  AND el recibo criptográfico registra el intento fallido

SCENARIO: BDD-384 Cuarentena Hermética de JavaScript Isolate sin Autoridad Ambiental
  GIVEN un script de agente que intenta acceder a process.env, require('fs') o fetch()
  WHEN el script se ejecuta en Tier ISOLATE dentro de node:vm
  THEN los objetos ambientales process, require, import y fetch son undefined o causan ReferenceError
  AND no se filtra ninguna variable de entorno ni secreto del host
  AND el estado es COMPLETED o ERROR_TRAPPED de forma segura

SCENARIO: BDD-385 Interrupción Determinista por Exceso de Tiempo (Timeout Kill)
  GIVEN un script con un bucle infinito ("while(true) {}") o cómputo excesivo
  WHEN se ejecuta con un límite de tiempo de 200 milisegundos
  THEN el motor interrumpe la ejecución de forma determinista
  AND el resultado reporta status: "TIMEOUT_KILLED"
  AND el proceso anfitrión continúa operando nominalmente

SCENARIO: BDD-386 Despacho MCP eos_wasm_sandbox y Atestación en Ledger SQLite
  GIVEN el servidor MCP de Glorian System en ejecución
  WHEN un cliente invoca eos_wasm_sandbox con código aritmético en Tier ISOLATE
  THEN el servidor responde con status: "COMPLETED", durationNs > 0 y executionReceiptSha256
  AND la transacción queda registrada en el ledger inmutable SQLite WAL
```
