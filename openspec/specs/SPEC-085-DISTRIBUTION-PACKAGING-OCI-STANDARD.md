# SPEC-085: ENTERPRISE DISTRIBUTION PACKAGING & OCI STANDARD

## 1. Specification Metadata
- **Spec ID**: `SPEC-085`
- **Change**: `CHANGE-063`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `71.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-302: Unified Layer-0 Export Entry Point
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA mantendrá un archivo de entrada maestro `src/index.ts` que exportará todos los motores, tipos e interfaces del núcleo puro de EOS System (`EosTrueTimeEngine`, `EosLsmTreeStorageEngine`, `EosThresholdCryptography`, `EosMicroVmEnclaveLauncher`, `EosPeerNode`, etc.) garantizando 100% de type-safety para consumidores de la librería.

### FR-303: Zero-Dependency Manifest Verification
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA verificará que el manifiesto de distribución pública preserve estrictamente el contrato de 0 dependencias externas en tiempo de ejecución (`dependencies: {}`), garantizando que cualquier instalación consuma código puro auditable.

### FR-304: Distroless OCI Multi-Stage Container Conformance
- **Pattern (State-Driven)**: MIENTRAS se evalúe el archivo `Dockerfile`, EL SISTEMA garantizará que la imagen final esté basada en Google Distroless (`gcr.io/distroless/static-debian12:nonroot`), ejecute bajo usuario sin privilegios `nonroot:nonroot` y produzca un binario estático sin intérpretes vulnerables ni shell.

### FR-305: Packaging Automated Audit Script
- **Pattern (Event-Driven)**: CUANDO se ejecute el script de empaquetado `node scripts/verify-packaging.mjs`, EL SISTEMA auditará la presencia de exports en `src/index.ts`, la integridad del `Dockerfile`, la validez de licencias y el cumplimiento de las leyes de pureza arquitectónica.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-245: Integridad del punto de entrada unificado src/index.ts
  DADO el archivo src/index.ts
  CUANDO se compila con TypeScript y se inspeccionan sus exportaciones
  ENTONCES expone limpiamente todos los motores de nivel hyperscaler
  Y no importa dependencias externas no declaradas.

ESCENARIO: BDD-246: Verificación de empaquetado OCI y manifiesto de distribución
  DADO el script scripts/verify-packaging.mjs
  CUANDO se ejecuta en el entorno de pruebas
  ENTONCES valida el Dockerfile distroless y el paquete v71.0.0 con código de salida 0.
```
