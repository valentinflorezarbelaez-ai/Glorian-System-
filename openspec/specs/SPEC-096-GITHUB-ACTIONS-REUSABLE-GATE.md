# SPEC-096: UNIVERSAL GITHUB ACTIONS REUSABLE WORKFLOW & CRITERIAL PR GATE

## 1. Specification Metadata
- **Spec ID**: `SPEC-096`
- **Change**: `CHANGE-066`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `74.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-346: Reusable GitHub Actions Workflow Specification
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA expondrá un flujo de trabajo reutilizable en `.github/workflows/eos-strict-gate.yml` con disparador `workflow_call` que permita a cualquier repositorio consumidor invocar el escaneo de 7 estadios de EOS System con una única línea `uses: valentinflorezarbelaez-ai/Eos-System/.github/workflows/eos-strict-gate.yml@main`.

### FR-347: Multi-Stage Criterial Gate Enforcement
- **Pattern (Event-Driven)**: CUANDO se abra o actualice un Pull Request en un repositorio gobernado, EL SISTEMA ejecutará la verificación secuencial de:
  1. Escaneo de secretos y credenciales en texto plano (Ley VI).
  2. Pureza arquitectónica y 0 dependencias npm en runtime (Ley V).
  3. Verificación de especificaciones formales EARS y BDD (Leyes I y II).
  4. Chequeo de tipos estricto y 100% de suites de prueba pasando.

### FR-348: Standard SARIF v2.1.0 Receipt Export
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA generará un archivo de reporte en formato OASIS SARIF v2.1.0 (`docs/evidence/local-checks.sarif`) compatible con la pestaña de Seguridad y Escaneo de Código de GitHub.

### FR-349: PR Blocking on Drift Violation
- **Pattern (Error / Unwanted Condition)**: SI el análisis detecta código sin especificación formal previa aprobada o dependencias externas no declaradas, ENTONCES EL SISTEMA emitirá una conclusión de fallo con código de salida 1, bloqueando la fusión a la rama principal.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-267: Validación de estructura de flujo reutilizable de GitHub Actions
  DADO el archivo .github/workflows/eos-strict-gate.yml
  CUANDO se audita su sintaxis YAML y disparadores
  ENTONCES contiene la clave "on: workflow_call"
  Y define los trabajos de escaneo estricto y exportación de recibos SARIF.

ESCENARIO: BDD-268: Verificación determinista de PR gate y generación de reporte SARIF
  DADO el script de atestación de PR scripts/eos-github-pr-attestation.mjs
  CUANDO se ejecuta en un entorno de pruebas simulado
  ENTONCES genera un documento SARIF válido v2.1.0 con código de salida 0
  Y sella el recibo con un hash SHA-256 inmutable.
```
