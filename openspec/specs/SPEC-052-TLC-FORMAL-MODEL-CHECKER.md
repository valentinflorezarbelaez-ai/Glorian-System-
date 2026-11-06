# SPEC-052 — LESLIE LAMPORT TLC FORMAL MODEL CHECKER & EXHAUSTIVE STATE SPACE VERIFICATION
**Version**: 58.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-045  
**Architecture Decision Record**: ADR-058  
**Domain Layer**: Layer-0 System Core (`src/core/eosTlcFormalChecker.ts`)

---

## 1. Executive Summary
Inspired by Leslie Lamport's TLA+ model checking principles and AWS Automated Reasoning Group methodologies, SPEC-052 formalizes the EOS TLC Formal Model Checker. The engine provides dual-mode verification: exhaustive state-space model checking via `tla2tools.jar` when a Java runtime is available, and transparent fallback to hermetic in-memory bounded JS simulations when running in minimal offline environments. It computes exact state counts, enforces deadlock and safety invariant checks, seals cryptographic SHA-256 receipts, and records verifiable attestations in the durable SQLite WAL ledger with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-177: Dual-Mode Runtime Detection
**State-Driven**: MIENTRAS se evalúa un modelo formal `.tla`, EL SISTEMA detectará la presencia de Java y `tla2tools.jar` en el entorno para seleccionar dinámicamente entre ejecución nativa TLC o simulación acotada en JavaScript.

### FR-178: Ejecución Exhaustiva de Model Checking TLC
**Event-Driven**: CUANDO Java y `tla2tools.jar` están disponibles, EL SISTEMA ejecutará el comando TLC formal (`-modelcheck -deadlock`) contra el archivo de especificación TLA+ y su configuración `.cfg`, parseando los estados explorados y verificando invariantes.

### FR-179: Fallback Transparente a Simulador Bounded JS
**Error / Unwanted Condition**: SI Java o `tla2tools.jar` no están presentes en el entorno host, ENTONCES EL SISTEMA ejecutará la simulación determinista acotada de JS como fallback hermético, asignando el estado epistémico `TLC_RUNTIME_UNAVAILABLE_FALLBACK_BOUNDED_JS` sin interrumpir la suite CI.

### FR-180: Arnés de Descarga Segura de tla2tools.jar
**Event-Driven**: CUANDO el usuario o agente solicita la instalación de TLC (`eos tlc install`), EL SISTEMA descargará `tla2tools.jar` desde el repositorio oficial de GitHub de TLA+ usando exclusivamente `node:https` y verificará su integridad por tamaño y cabeceras.

### FR-181: Atestación Criptográfica y Métricas de Espacio de Estados
**Ubiquitous / Permanent**: EL SISTEMA calculará el hash SHA-256 del modelo TLA+, los estados explorados, el modo de ejecución y el veredicto final, emitiendo un recibo inmutable de 64 caracteres hexadecimales.

### FR-182: Persistencia en Ledger SQLite WAL
**Event-Driven**: CUANDO concluye una verificación formal TLC o de fallback, EL SISTEMA persistirá el recibo en `EosDurableSqliteLedger` bajo la categoría `VERIFICATION_RECEIPT` o `SECURITY_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-173: Dual-Mode TLC Runtime Detection & Status Reporting
```gherkin
ESCENARIO: Detección Dinámica de Runtime Java y TLC Jar
  DADO un entorno de ejecución host
  CUANDO el motor EosTlcFormalChecker inspecciona la disponibilidad de herramientas
  ENTONCES retorna un diagnóstico con el estado de Java, ruta de tla2tools.jar y modo recomendado
  Y no genera excepciones no controladas si Java está ausente
```

### BDD-174: Exhaustive TLC Model Checking Execution
```gherkin
ESCENARIO: Ejecución Exhaustiva de Modelo Formal TLC
  DADO un entorno con Java y tla2tools.jar configurados
  CUANDO se ejecuta la verificación de un modelo formal TLA+
  ENTONCES ejecuta el proceso TLC y extrae los estados explorados y transiciones
  Y confirma veredicto "PASS" si todos los invariantes se preservan
```

### BDD-175: Transparent Bounded JS Simulation Fallback
```gherkin
ESCENARIO: Fallback Hermético a Simulación JS cuando Java está Ausente
  DADO un entorno donde Java no está disponible en el PATH
  CUANDO se solicita la verificación del modelo TLA+
  ENTONCES conmuta al simulador determinista de JavaScript
  Y reporta estado "FALLBACK_BOUNDED_JS" con verificación de invariantes exitosa
```

### BDD-176: Safe Download and Caching of tla2tools.jar
```gherkin
ESCENARIO: Descarga Segura de tla2tools.jar vía HTTPS Nativo
  DADO una solicitud para instalar o actualizar herramientas TLC
  CUANDO el motor descarga el archivo jar hacia la carpeta tools/
  ENTONCES utiliza exclusivamente node:https sin dependencias npm externas
  Y valida que el archivo resultante es un archivo Jar válido
```

### BDD-177: Cryptographic Verification Receipt & Ledger Monotonic Chain
```gherkin
ESCENARIO: Sello Criptográfico SHA-256 y Registro en SQLite WAL
  DADO un reporte de verificación formal concluido
  CUANDO el motor genera el recibo y lo persiste en el ledger
  ENTONCES produce un hash SHA-256 de 64 caracteres
  Y el registro queda indexado en SQLite WAL con búsqueda FTS5
```

### BDD-178: MCP Dispatch of eos_tlc_checker via EosMcpServer
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_tlc_checker
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_tlc_checker" con acción "check" o "status"
  ENTONCES retorna el diagnóstico del entorno y el resultado de verificación formal
```
