# SPEC-060 — AUTONOMOUS SAPFIX PR & AUTO-MERGE ENGINE (META-GRADE FDIR)
**Version**: 66.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-053  
**Architecture Decision Record**: ADR-065  
**Domain Layer**: Layer-0 System Core (`src/core/eosSapFixAutoshipper.ts`)

---

## 1. Executive Summary
Inspired by Meta's SapFix automated program repair architecture, NASA IV&V zero-regression barriers, and GitHub Actions PR workflows, SPEC-060 formalizes the EOS Autonomous SapFix PR & Auto-Merge Engine. When regressions, runtime faults, or invariant violations are detected, the engine coordinates with `EosSurgicalSelfHealingKernel`, creates an isolated ephemeral Git worktree, synthesizes and applies the surgical AST patch, verifies all 7 SecDevOps quality stages in hermetic isolation, generates an auditable cryptographic PR manifest with SHA-256 evidence, and commits or opens a verified Pull Request with zero manual vibe coding and zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-195: Automated Fault Intake and Worktree Branch Isolation
**Event-Driven**: CUANDO el motor recibe una alerta de fallo en pruebas o verificación (`SapFixFaultInput`), EL SISTEMA creará una rama aislada (`fix/sapfix-<faultId>-<timestamp>`) y un worktree temporal efímero para evitar colisiones con el workspace principal.

### FR-196: Invocación de Auto-Sanación Quirúrgica AST
**State-Driven**: MIENTRAS opera en el worktree aislado, EL SISTEMA ejecutará el núcleo `EosSurgicalSelfHealingKernel` para derivar la corrección mínima sin mutar archivos fuera de la función infractora.

### FR-197: Barrera de Validación Hermética de 7 Aduanas
**Ubiquitous / Permanent**: EL SISTEMA ejecutará la suite de verificación completa dentro del worktree aislado, exigiendo `exit code 0` y cero regresiones en todas las pruebas existentes antes de autorizar cualquier commit.

### FR-198: Rechazo Quirúrgico Fail-Closed ante Regresiones
**Error / Unwanted Condition**: SI el parche de auto-sanación no resuelve el fallo o introduce una regresión en cualquier otra prueba preexistente, ENTONCES EL SISTEMA abortará la rama, limpiará el worktree efímero y registrará el estado epistémico `REMEDIATION_REJECTED_REGRESSION` en el Ledger.

### FR-199: Generación de Manifiesto Criptográfico de Pull Request
**Event-Driven**: CUANDO la verificación en el worktree aislado resulta 100% exitosa, EL SISTEMA generará el payload completo del Pull Request con descripción estructurada Markdown, diff de AST, registro de pruebas pasando y atestación SHA-256.

### FR-200: Registro Inmutable en SQLite WAL Ledger
**Ubiquitous / Permanent**: EL SISTEMA persistirá cada ciclo de SapFix en `EosDurableSqliteLedger` bajo la categoría `SECURITY_AUDIT` con hash encadenado SHA-256 inmutable.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-185: Autonomous Worktree Creation and Fault Isolation
```gherkin
ESCENARIO: Aislamiento Autónomo de Fallo en Worktree Efímero
  DADO un reporte de fallo con ID "FAULT-882" y archivo infractor identificado
  CUANDO el motor SapFix inicia el ciclo de reparación
  ENTONCES crea una rama temporal "fix/sapfix-FAULT-882" en un directorio aislado
  Y no modifica el directorio de trabajo activo del desarrollador
```

### BDD-186: Surgical Patch Application and Hermetic Verification
```gherkin
ESCENARIO: Aplicación Quirúrgica y Validación de Cero Regresiones
  DADO un código defectuoso con excepción de referencia nula en el worktree aislado
  CUANDO el motor aplica el parche AST de salvaguarda mínima
  ENTONCES la prueba que fallaba pasa exitosamente
  Y el resultado de la suite reporta "VERIFIED_ZERO_REGRESSIONS"
```

### BDD-187: Autonomous PR Manifest Generation and Ledger Attestation
```gherkin
ESCENARIO: Generación del Manifiesto de Pull Request con Sello Criptográfico
  DADO un ciclo de reparación verificado exitosamente
  CUANDO el motor genera el paquete de Pull Request
  ENTONCES produce un título formal con formato convencional "fix(fdir): ..."
  Y una descripción Markdown con tabla de auditoría y recibo SHA-256 de 64 caracteres
  Y registra el recibo en el Ledger SQLite WAL
```
