# SPEC-075 — ACTIVE KERNEL PROCESS ENFORCER & RUNTIME CONTAINMENT
**Version**: 69.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-061  
**Architecture Decision Record**: ADR-080  
**Domain Layer**: Layer-0 System Core (`src/core/eosActiveKernelProcessEnforcer.ts`)

---

## 1. Executive Summary
Inspired by AWS Nitro Enclaves, Google gVisor application sandboxing, and Windows JobObject kernel containment, SPEC-075 formalizes the EOS Active Kernel Process Enforcer. Operating under Layer-0 purity with zero external npm dependencies, this engine bridges the gap between passive policy generation and active runtime containment. It executes child agent processes within strict operating-system-level constraints: bounded virtual memory commit limits, wall-clock execution deadlines, and fail-closed termination upon quota breach, emitting tamper-proof execution receipts registered into the durable SQLite WAL ledger.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-262: Active Subprocess Execution under Enforced Boundaries
**Event-Driven**: CUANDO un comando o tarea de agente requiera aislamiento estricto, EL SISTEMA ejecutará el proceso hijo imponiendo límites de tiempo de CPU y memoria máxima antes de iniciar la ejecución.

### FR-263: Detección y Contención de Desbordamiento de Memoria / Tiempo
**State-Driven**: MIENTRAS el proceso hijo se encuentre en ejecución, SI el proceso excede la cuota de memoria o el tiempo límite de ejecución (*timeout*), ENTONCES EL SISTEMA terminará forzosamente el proceso (`SIGKILL` o `taskkill /F /T`) sin permitir fugas de subprocesos huérfanos.

### FR-264: Inspección de Límites de Contención de Kernel (JobObject / cgroups)
**Ubiquitous / Permanent**: EL SISTEMA inspeccionará la configuración de contención del sistema operativo anfitrión (Windows JobObject MemoryLimit / Linux cgroups memory.max), validando el régimen fail-closed antes del despacho.

### FR-265: Emisión de Recibo Criptográfico de Ejecución Confinada
**Ubiquitous / Permanent**: EL SISTEMA generará un recibo inmutable SHA-256 conteniendo el código de salida, memoria utilizada, duración y firma del entorno, registrándolo en `EosDurableSqliteLedger`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-225: Clean Subprocess Execution Within Quotas
```gherkin
ESCENARIO: Ejecución Exitosa de Comando Seguro Confinado
  DADO un comando hermético que imprime un mensaje y finaliza dentro de los límites
  CUANDO se ejecuta bajo el Active Kernel Process Enforcer con límite de 2000ms
  ENTONCES el proceso completa con código de salida 0
  Y se emite un recibo criptográfico SHA-256 de ejecución exitosa
```

### BDD-226: Fail-Closed Subprocess Termination on Timeout Violation
```gherkin
ESCENARIO: Terminación Forzosa ante Violación de Tiempo Límite
  DADO un comando que intenta ejecutarse indefinidamente (bucle infinito)
  CUANDO se lanza con un límite estricto de 250ms
  ENTONCES el enforcer aborta y termina el proceso inmediatamente
  Y reporta estado TIMEOUT_VIOLATION con código de salida no nulo
```
