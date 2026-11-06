# SPEC-133: Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine

**Version**: 1.0.0  
**Milestone**: v91.0.0  
**Status**: APPROVED  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Governing Documents**: `INTAKE-071`, `CHANGE-071`, `PLAN-071`, `TASKS-071`, `GLORIAN_20_FRONTIERS_CODEX.md`  

---

## 1. Executive Summary
SPEC-133 establishes the **Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine** (`EosNocturnalEvolutionEngine`). It fulfills Frontier Level 19 by executing continuous autonomous debt eradication, multivariate fitness scoring (AlphaEvolve), and safe AST diet optimization during background or nocturnal operational windows, exposed via CLI (`glorian night:evolve`) and MCP (`eos_nocturnal_evolution`).

---

## 2. Functional Requirements (EARS Syntax)

### FR-001 (Event-Driven: Nocturnal Evolution Execution)
CUANDO el operador, tarea programada o agente invoca `glorian night:evolve` o la herramienta MCP `eos_nocturnal_evolution`, EL SISTEMA ejecutará el barrido evolutivo sobre el directorio objetivo analizando duplicación, código muerto y cuellos de botella de complejidad.

### FR-002 (State-Driven: Multivariate Fitness Scoring)
MIENTRAS el motor procesa los módulos de código fuente, EL SISTEMA calculará el vector de fitness multivariado evaluando pureza del AST, potencial reducción de líneas y puntaje de complejidad ciclomática.

### FR-003 (Ubiquitous: Cryptographic Attestation & Ledger Commitment)
EL SISTEMA generará un recibo criptográfico SHA-256 por cada ciclo de evolución completado y registrará la entrada inmutablemente en `EosDurableSqliteLedger`.

### FR-004 (Unwanted Condition: Zero-Regression Safety Guard)
SI una mutación o refactorización sugerida altera el comportamiento semántico o rompe un invariante de prueba, ENTONCES EL SISTEMA abortará la aplicación de dicho cambio preservando el código original intacto.

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
ESCENARIO: BDD-350 Barrido Evolutivo Nocturno y Detección de Deuda Técnica
  DADO un directorio de código fuente con módulos TypeScript
  CUANDO el motor EosNocturnalEvolutionEngine ejecuta runEvolutionSweep()
  ENTONCES el reporte contiene el conteo de archivos analizados, duplicaciones y complejidad
  Y se calcula el vector de fitness compuesto (0 a 100)
  Y se emite un recibo criptográfico SHA-256 de 64 caracteres.

ESCENARIO: BDD-351 Formateo de Reporte TUI para Consola Nocturna
  DADO un reporte de evolución nocturna completado
  CUANDO se invoca formatNocturnalSummary(report)
  ENTONCES la salida en texto contiene el banner de evolución darwiniana, métricas de fitness y balance de deuda.

ESCENARIO: BDD-352 Despacho de Herramienta MCP eos_nocturnal_evolution
  DADO el servidor EosMcpServer inicializado
  CUANDO se invoca tools/call para eos_nocturnal_evolution
  ENTONCES el servidor retorna un JSON con estado EVOLUTION_CYCLE_COMPLETED y score de fitness válido.
```

---

## 4. Architectural Boundaries (Law V)
- **Zero Runtime Dependencies**: Strict Layer-0 Node.js native libraries only (`node:fs`, `node:path`, `node:crypto`).
- **Node 24 Compatibility**: Strip-only TypeScript.
- **Traceability**: Monotonic ledger commit in `EosDurableSqliteLedger`.
