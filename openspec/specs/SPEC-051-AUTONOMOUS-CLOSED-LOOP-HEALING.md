# SPEC-051 — AUTONOMOUS CLOSED-LOOP SURGICAL SELF-HEALING KERNEL
**Version**: 57.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-044  
**Architecture Decision Record**: ADR-057  
**Domain Layer**: Layer-0 System Core (`src/core/eosSurgicalSelfHealingKernel.ts`)

---

## 1. Executive Summary
Inspired by NASA FDIR (Fault Detection, Isolation, and Recovery) and Meta SapFix / GetAFix automated program repair, SPEC-051 formalizes the EOS Autonomous Closed-Loop Surgical Self-Healing Kernel. The kernel isolates runtime fault locations, synthesizes minimal AST surgical diffs, runs closed-loop verification in isolated in-memory sandboxes, enforces zero-regression barriers, and records cryptographic receipts in durable SQLite WAL ledgers with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-171: FDIR Fault Detection and Root-Cause Isolation
**Event-Driven**: CUANDO el motor recibe un reporte de fallo de ejecución o excepción de invariante (`DiagnosticFaultInput`), EL SISTEMA aislará el archivo objetivo, la función infractora y el rango exacto de líneas del fallo, descartando código no relacionado.

### FR-172: Síntesis de Parche Quirúrgico Mínimo (AST-Level)
**Ubiquitous / Permanent**: EL SISTEMA sintetizará mutaciones correctivas mínimas (AST surgical patches) restringidas exclusivamente al nodo o expresión responsable del fallo, prohibiendo reescrituras globales o modificaciones de contratos intactos.

### FR-173: Verificación Closed-Loop en Sandbox de Memoria
**State-Driven**: MIENTRAS se evalúa un parche candidato, EL SISTEMA ejecutará el código parcheado en un sandbox hermético en memoria contra el caso de prueba infractor para verificar que el fallo original queda resuelto con código de salida 0.

### FR-174: Barrera de Re-validación Libre de Regresiones
**Error / Unwanted Condition**: SI un parche candidato resuelve el fallo original pero provoca la ruptura de cualquier otro test o invariante preexistente (`REGRESSION_DETECTED`), ENTONCES EL SISTEMA descartará el parche inmediatamente y probará la siguiente estrategia quirúrgica.

### FR-175: Atestación Criptográfica de Auto-Sanación
**Ubiquitous / Permanent**: EL SISTEMA calculará el hash SHA-256 del contenido previo, del parche aplicado y del resultado de verificación, sellando la atestación de auto-sanación.

### FR-176: Registro en Ledger SQLite WAL
**Event-Driven**: CUANDO una operación de auto-sanación quirúrgica concluye, EL SISTEMA registrará la atestación completa en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT` o `MISSION_DIRECTION`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-167: FDIR Fault Localization
```gherkin
ESCENARIO: Localización Quirúrgica de Causa Raíz FDIR
  DADO un stack trace de fallo con error "TypeError: Cannot read properties of undefined (reading 'length')"
  CUANDO el kernel procesa el diagnóstico
  ENTONCES identifica con precisión el archivo objetivo, la línea infractora y la variable no definida
  Y genera un registro de diagnóstico estructurado sin alterar el código
```

### BDD-168: Minimal Guard Patch Synthesis
```gherkin
ESCENARIO: Síntesis de Parche Quirúrgico de Salvaguarda Mínima
  DADO un archivo con una función que accede a una propiedad sin verificación de nulabilidad
  CUANDO el kernel genera el parche de auto-sanación
  ENTONCES produce un diff mínimo que inserta la guarda de nulabilidad requerida
  Y preserva el 100% del resto del archivo y sus comentarios intactos
```

### BDD-169: Closed-Loop Sandbox Verification
```gherkin
ESCENARIO: Verificación Closed-Loop en Sandbox Aislado
  DADO un parche quirúrgico candidato generado para reparar un fallo
  CUANDO el kernel aplica el parche en memoria y ejecuta el arnés evaluador
  ENTONCES confirma que el fallo previo ahora pasa limpiamente
  Y el estado de sanación es "HEALED_VERIFIED"
```

### BDD-170: Zero-Regression Rejection Barrier
```gherkin
ESCENARIO: Rechazo de Parche con Regresión Colateral
  DADO un parche candidato que soluciona el fallo original pero rompe un contrato secundario
  CUANDO el kernel ejecuta la batería de regresión
  ENTONCES detecta la regresión
  Y rechaza el parche con estado "REGRESSION_REJECTED"
```

### BDD-171: Cryptographic Self-Healing Receipt & Ledger Persistence
```gherkin
ESCENARIO: Registro Duradero de Atestación de Auto-Sanación
  DADO un ciclo exitoso de auto-sanación quirúrgica
  CUANDO el kernel sella el recibo
  ENTONCES genera un hash SHA-256 de 64 caracteres
  Y persiste la atestación en EosDurableSqliteLedger
```

### BDD-172: MCP Dispatch of eos_surgical_healing
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_surgical_healing
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_surgical_healing" con acción "heal"
  ENTONCES retorna el diagnóstico FDIR, el parche quirúrgico y el resultado de verificación
```
