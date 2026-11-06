# SPEC-053 — NATIVE GITHUB ACTIONS PR GATE & CHECK-RUNS ATTESTATION BOT
**Version**: 59.0.0  
**Status**: APPROVED  
**Change Reference**: CHANGE-046  
**Architecture Decision Record**: ADR-059  
**Domain Layer**: Layer-0 System Core (`src/core/eosGithubPrGate.ts`)

---

## 1. Executive Summary
Inspired by Google Critique, Meta Phabricator / SapFix gates, and GitHub Enterprise Checks API standards, SPEC-053 formalizes the EOS Native GitHub Actions PR Gate. It connects EOS directly to GitHub Actions CI pipelines (`.github/workflows/eos-gate.yml`), extracts GitHub pull request event context, executes the 7 SecDevOps quality dimensions, runs Nubank/Buf contract breaking-change checks (`SPEC-050`), publishes official GitHub Check Runs (`status: "completed"`, `conclusion: "success" | "failure"`), and posts cryptographic Markdown attestations with zero external runtime npm dependencies.

---

## 2. Formal Functional Requirements (IEEE 830 EARS Patterns)

### FR-183: Extracción de Contexto de Pull Request en GitHub Actions
**Event-Driven**: CUANDO el workflow de GitHub Actions se ejecuta ante un evento `pull_request` o `push`, EL SISTEMA extraerá de forma determinista el repositorio, el commit SHA de cabecera, el número de PR y las ramas base y head a partir de variables de entorno estándar de GitHub.

### FR-184: Orquestación de las 7 Aduanas SecDevOps en CI
**State-Driven**: MIENTRAS se evalúa un Pull Request, EL SISTEMA ejecutará las 7 aduanas de seguridad y calidad (escaneo de credenciales, aserciones de landing, dependencias Capa 0, typecheck, suites de tests, aserciones estáticas y simulaciones TLA+).

### FR-185: Compuerta Pre-Merge de Compatibilidad de Contratos
**Error / Unwanted Condition**: SI el Pull Request introduce breaking changes en interfaces o migraciones SQL peligrosas (`SPEC-050`), ENTONCES EL SISTEMA marcará la compuerta como `FAILURE` y bloqueará la integración del PR.

### FR-186: Publicación de Check-Run en GitHub vía HTTPS Nativo
**Event-Driven**: CUANDO concluye la evaluación del PR, EL SISTEMA enviará la carga útil del Check Run (`name: "EOS Sovereign Gate"`) a la API REST de GitHub usando exclusivamente `node:https` y la autenticación del token `GITHUB_TOKEN`.

### FR-187: Formateo de Atestación Criptográfica en Markdown
**Ubiquitous / Permanent**: EL SISTEMA generará un reporte de verificación en Markdown formateado con tablas de taxonomía epistémica, desglose de las 7 aduanas, veredicto final y el hash SHA-256 del Ledger SQLite WAL.

### FR-188: Registro Monotónico en Ledger SQLite WAL
**Event-Driven**: CUANDO el Check Run es emitido, EL SISTEMA registrará la atestación completa en `EosDurableSqliteLedger` bajo la categoría `VERIFICATION_RECEIPT` o `SECURITY_AUDIT`.

---

## 3. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-179: GitHub Actions Environment Context Parsing
```gherkin
ESCENARIO: Extracción Segura de Parámetros de GitHub Actions
  DADO un conjunto de variables de entorno de GitHub Actions (GITHUB_REPOSITORY, GITHUB_SHA, etc.)
  CUANDO el motor EosGithubPrGate parsea el contexto
  ENTONCES extrae el propietario, nombre de repositorio, commit SHA y número de PR
  Y asigna valores por defecto seguros si se ejecuta fuera de CI
```

### BDD-180: Pre-Merge Contract Compatibility Gate Evaluation
```gherkin
ESCENARIO: Evaluación de Contratos en PR sin Breaking Changes
  DADO un PR con modificaciones en contratos compatibles hacia atrás
  CUANDO el motor ejecuta la compuerta de contratos
  ENTONCES confirma veredicto "APPROVED" y cero contracciones rompientes
  Y autoriza la continuación de la compuerta
```

### BDD-181: Check-Run Payload Formatting (GitHub API Standard)
```gherkin
ESCENARIO: Generación de Carga Útil para GitHub Checks API
  DADO un resultado de evaluación con 7 aduanas aprobadas
  CUANDO el motor formatea la carga útil del Check Run
  ENTONCES incluye name "EOS Sovereign Gate", status "completed", conclusion "success"
  Y contiene el resumen con título y texto en Markdown estructurado
```

### BDD-182: Markdown PR Summary Report Generation
```gherkin
ESCENARIO: Generación de Comentario de Atestación para PR
  DADO un reporte de auditoría completo con hash SHA-256
  CUANDO el motor genera el markdown del reporte
  ENTONCES incluye tabla de las 7 aduanas, estado epistémico y recibo SHA-256 de 64 caracteres
  Y no contiene datos sensibles ni credenciales en el texto
```

### BDD-183: Fail-Closed Merge Barrier Enactment
```gherkin
ESCENARIO: Bloqueo de PR con Fallos o Contratos Rompientes
  DADO un PR que introduce una contracción de contrato o un fallo en los tests
  CUANDO el motor evalúa el PR
  ENTONCES emite conclusión "failure"
  Y genera el diagnóstico del fallo impidiendo el merge
```

### BDD-184: MCP Dispatch of eos_github_gate via EosMcpServer
```gherkin
ESCENARIO: Invocación de Herramienta MCP eos_github_gate
  DADO un servidor EosMcpServer en perfil "core"
  CUANDO se invoca "eos_github_gate" con acción "evaluate"
  ENTONCES retorna el veredicto del PR, el payload del check run y el recibo sellado
```
