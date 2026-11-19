# SPEC-367: Autonomous Dynamic Tool Synthesis & JIT Skill Compiler

**Specification ID**: `SPEC-367`  
**Change Reference**: `CHANGE-229`  
**Lifecycle Tier**: `production`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Formal TLA+ Model**: `docs/formal/DynamicToolSynthesis.tla` (Model 110)  
**Status**: `APPROVED`

---

## 1. Scope & Domain Context

This specification formally establishes the requirements, interfaces, state invariants, and verification criteria for `EosDynamicToolSynthesis`. The engine enables Glorian System to dynamically synthesize, sandbox-verify, and hot-register new MCP tools and CLI capabilities at runtime from arbitrary schema descriptors (OpenAPI, CLI manpages, TypeScript interfaces) without requiring application re-compilation or control plane downtime.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-367-01 (Ubiquitous Layer-0 Tool Compilation)**:
  `EL SISTEMA DEBE compilar adaptadores de herramientas tipadas utilizando exclusivamente primitivas nativas de JavaScript/TypeScript sin dependencias externas de tiempo de ejecución.`

- **FR-367-02 (Event-Driven Multi-Format Schema Ingestion)**:
  `CUANDO se recibe una especificación de interfaz externa (OpenAPI JSON, definición CLI o interfaz TypeScript), EL SISTEMA DEBE analizar la signatura sintáctica y generar una definición canónica de herramienta compatible con MCP JSON-RPC 2.0.`

- **FR-367-03 (State-Driven Sandboxed Execution Verification)**:
  `MIENTRAS una herramienta sintetizada se encuentre en estado preliminar ('UNVERIFIED'), EL SISTEMA DEBE someterla a pruebas de ejecución en un contexto virtual aislado (sandbox en memoria) con entradas sintéticas acotadas, verificando que no ocurran fugas de memoria ni violaciones de seguridad.`

- **FR-367-04 (Event-Driven Zero-Downtime Hot-Registration)**:
  `CUANDO la herramienta sintetizada supera la verificación de sandbox, EL SISTEMA DEBE inyectar atómicamente la herramienta en la tabla de despacho MCP activa y en el catálogo CLI sin reiniciar el proceso del servidor.`

- **FR-367-05 (Ubiquitous Cryptographic Schema & Audit Trail)**:
  `EL SISTEMA DEBE calcular la huella criptográfica SHA-256 de cada herramienta sintetizada, asegurando inmutabilidad, trazabilidad y cumplimiento estricto con los esquemas de validación de SPEC-205.`

- **FR-367-06 (State-Driven Dynamic Tool Lifecycle Management)**:
  `MIENTRAS las herramientas dinámicas se encuentren registradas, EL SISTEMA DEBE mantener su estado de salud, métricas de invocación, latencia de respuesta y registro de errores en memoria.`

- **FR-367-07 (Error / Unwanted Condition Automatic Rollback Safety)**:
  `SI una herramienta sintetizada falla durante la ejecución de prueba o genera una excepción no controlada en el sandbox, ENTONCES EL SISTEMA DEBE abortar inmediatamente el registro ('REJECTED'), revertir la tabla de despacho al estado previo y emitir una alerta diagnóstica inmutable.`

---

## 3. Acceptance Criteria (BDD Syntax)

### BDD-1981: OpenAPI & CLI Schema Parsing into MCP Definition

```gherkin
ESCENARIO: Análisis sintáctico de especificación externa a esquema MCP canónico
  DADO una especificación de endpoint OpenAPI o comando CLI válido
  CUANDO el sintetizador procesa la interfaz
  ENTONCES genera una estructura de herramienta McpToolSchemaDef
  Y valida que el nombre, descripción y schema de argumentos son conformes.
```

### BDD-1982: Sandboxed Validation of Synthesized Tool Handlers

```gherkin
ESCENARIO: Verificación de ejecución segura en sandbox aislado
  DADO un adaptador de herramienta sintetizado dinámicamente
  CUANDO el motor ejecuta la batería de validación con inputs sintéticos en sandbox
  ENTONCES la herramienta responde con código de éxito y salida estructurada
  Y no produce fugas de contexto ni violaciones de memoria.
```

### BDD-1983: Zero-Downtime Live Dispatch Table Registration

```gherkin
ESCENARIO: Registro atómico de nueva herramienta sin reinicio de proceso
  DADO el control plane MCP en ejecución nominal
  CUANDO una herramienta sintetizada pasa la verificación de sandbox
  ENTONCES queda registrada en la tabla de despacho activa
  Y se puede invocar inmediatamente mediante JSON-RPC sin reiniciar el servidor.
```

### BDD-1984: Dynamic Tool Invocation & Metrics Telemetry

```gherkin
ESCENARIO: Invocación exitosa de herramienta JIT y captura de métricas
  DADO una herramienta dinámica registrada en el despachador
  CUANDO un agente realiza una llamada a la herramienta con argumentos válidos
  ENTONCES ejecuta la acción en menos de 50 milisegundos
  Y registra la llamada en las métricas de invocación y telemetría de salud.
```

### BDD-1985: Faulty Tool Rejection and Atomic Rollback

```gherkin
ESCENARIO: Rechazo de herramienta errónea y reversión segura
  DADO un adaptador con errores de sintaxis o comportamiento malicioso simulado
  CUANDO el sandbox detecta una falla durante la verificación
  ENTONCES marca la herramienta como 'REJECTED'
  Y la tabla de despacho permanece 100% inalterada sin registrar la herramienta corrupta.
```

### BDD-1986: Full Diagnostic Audit & JIT Synthesis Receipt

```gherkin
ESCENARIO: Auditoría completa del compilador JIT y emisión de recibo formal
  DADO el motor EosDynamicToolSynthesis en estado operativo
  CUANDO se ejecuta la auditoría diagnóstica integral
  ENTONCES todas las comprobaciones (Parsing, Sandbox, Live-Registration, Telemetry, Rollback) resultan 'PASS'
  Y emite un recibo criptográfico firmado SHA-256 referenciando SPEC-367 y CHANGE-229.
```
