# SPEC-132: Glorian Fleet Pulse & Tactical Sovereignty Radar

**Version**: 1.0.0  
**Milestone**: v90.0.0  
**Status**: APPROVED  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Governing Documents**: `INTAKE-070`, `CHANGE-070`, `PLAN-070`, `TASKS-070`  

---

## 1. Executive Summary
SPEC-132 establishes the **Glorian Fleet Pulse & Tactical Sovereignty Radar** (`EosFleetPulseEngine`). It provides an ultra-fast in-memory and git-porcelain auditor for the 9 sovereign repositories of the Glorian fleet, combining technical telemetry (git branch, HEAD commit, clean tree, production URL, Soundcheck score) with esoteric-gnostic archetype bindings, exposed via CLI (`glorian fleet:pulse`) and MCP (`eos_fleet_pulse`).

---

## 2. Functional Requirements (EARS Syntax)

### FR-001 (Event-Driven: Fleet Pulse Audit Trigger)
CUANDO el operador o agente invoca `glorian fleet:pulse` o la herramienta MCP `eos_fleet_pulse`, EL SISTEMA auditará simultáneamente los 9 repositorios registrados en `docs/projects/registry.json` y calculará el estado de cada proyecto en menos de 250ms.

### FR-002 (State-Driven: Porcelain & Soundcheck Evaluation)
MIENTRAS evalúa cada repositorio de la flota, EL SISTEMA verificará la existencia en disco, el estado de trabajo inmaculado (`git status --porcelain`), la rama activa, el commit SHA y el enlace de producción activo.

### FR-003 (Ubiquitous: Esoteric-Gnostic Archetype Preservation)
EL SISTEMA asociará permanentemente cada repositorio a su arquetipo gnóstico (HAM-SAH Prana, Tercer Factor, Gnosis Sagrada, Testimonio de Maestría, S.A.W Operaciones, Aberamentho Pleroma, Sol Central Glorian, TaskFlow Eficiencia, Avo Pack Justicia Material).

### FR-004 (Unwanted Condition: Unreachable Repo Mitigation)
SI un repositorio no existe localmente o su árbol de trabajo presenta cambios sin confirmar, ENTONCES EL SISTEMA asignará el estado `NEEDS_ATTENTION` o `UNREGISTERED_LOCAL` sin interrumpir la evaluación del resto de la flota.

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
ESCENARIO: BDD-340 Auditoría Integral del Pulso de los 9 Repositorios de la Flota
  DADO el archivo de configuración docs/projects/registry.json con 9 proyectos
  CUANDO el motor EosFleetPulseEngine ejecuta auditFleetPulse()
  ENTONCES se evalúan los 9 proyectos retornando totalProjects igual a 9
  Y el quorum de salud supera el 85%
  Y se emite un recibo criptográfico SHA-256 de 64 caracteres.

ESCENARIO: BDD-341 Mapeo de Arquetipos Esotérico-Gnósticos por Proyecto
  DADO el reporte de pulso generado por EosFleetPulseEngine
  CUANDO se inspeccionan los proyectos individuales
  ENTONCES cada proyecto contiene su título arquetípico gnóstico asignado
  Y el Sol Central corresponde a eos-system / Glorian Core.

ESCENARIO: BDD-342 Formateo de Tabla TUI de Alta Densidad para Terminal
  DADO un reporte de pulso válido
  CUANDO se invoca formatPulseTable(report)
  ENTONCES la salida en texto contiene encabezados formateados, nombres de proyectos, ramas y estados.

ESCENARIO: BDD-343 Despacho de Herramienta MCP eos_fleet_pulse
  DADO el servidor EosMcpServer inicializado
  CUANDO se ejecuta una petición tools/call para eos_fleet_pulse
  ENTONCES el servidor retorna un JSON con totalProjects 9 y status PRISTINE o HEALTHY.
```

---

## 4. Architectural Boundaries (Law V)
- **Zero Runtime Dependencies**: Strict Layer-0 Node.js native libraries (`node:fs`, `node:path`, `node:child_process`, `node:crypto`).
- **Node 24 Compatibility**: Strip-only TypeScript.
- **Traceability**: Monotonic ledger commit in `EosDurableSqliteLedger`.
