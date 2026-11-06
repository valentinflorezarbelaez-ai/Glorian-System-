# SPEC-100: AUTONOMOUS FLEET DOGFOODING & CROSS-REPOSITORY ATTESTATION

## 1. Specification Metadata
- **Spec ID**: `SPEC-100`
- **Change**: `CHANGE-067`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `75.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-362: Fleet Registry Resolution & Discovery
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA resolverá el inventario de proyectos registrados en `docs/projects/registry.json`, extrayendo para cada entrada su identificador, URL de producción, scripts de verificación y nivel de autorización según la Ley IV de la Constitución.

### FR-363: Non-Invasive Contract & Quality Audit
- **Pattern (Event-Driven)**: CUANDO se invoque `EosFleetDogfoodingEngine.auditTargetProject(projectId)` o `scripts/eos-fleet-dogfood-audit.mjs`, EL SISTEMA ejecutará una inspección no invasiva de sólo lectura sobre el repositorio objetivo (ej. `crud-slack` o `portafolio`), evaluando presencia de secretos, contratos de interfaz, accesibilidad semántica y cobertura de verificación.

### FR-364: Unified Cross-Fleet SARIF v2.1.0 Aggregation
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA consolidará los hallazgos de la auditoría de la flota en un reporte OASIS SARIF v2.1.0 unificado (`docs/evidence/fleet-audit.sarif`), asignando niveles de severidad (`error`, `warning`, `note`) e inyectando un sello criptográfico SHA-256 inmutable.

### FR-365: Law IV External Write Barrier Guard
- **Pattern (Error / Unwanted Condition)**: SI el motor detecta un intento de mutación o escritura sobre un directorio externo sin autorización explícita de Nivel 3 y aprobación formal registrada, ENTONCES EL SISTEMA abortará la operación de inmediato emitiendo una excepción `LawIvExternalWriteBarrierViolation`.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-275: Descubrimiento y auditoría no invasiva de proyectos en la flota
  DADO el motor src/core/eosFleetDogfoodingEngine.ts y docs/projects/registry.json
  CUANDO se audita el proyecto "crud-slack" o "portafolio"
  ENTONCES recopila métricas de salud técnica sin modificar archivos externos
  Y retorna un estado de evaluación conforme a la taxonomía epistémica.

ESCENARIO: BDD-276: Consolidación y sellado criptográfico del reporte SARIF de la flota
  DADO un resultado de auditoría de la flota
  CUANDO se genera el reporte docs/evidence/fleet-audit.sarif
  ENTONCES la estructura cumple el estándar OASIS SARIF v2.1.0
  Y el hash SHA-256 es computado determinísticamente con código de salida 0.
```
