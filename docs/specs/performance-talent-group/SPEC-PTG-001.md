# SPEC-PTG-001: Performance Talent Group — Level 3 Governance Elevation

## 1. Specification Metadata

- **Spec ID**: `SPEC-PTG-001` (project-scoped; **not** a new OpenSpec catalog id)
- **Project**: `performance-talent-group`
- **Status**: `SPECIFICATION_APPROVED`
- **Composes**: SPEC-042 / SPEC-056 / SPEC-100 / SPEC-124, Law IV / Law VI
- **Date**: `2026-11-09`
- **Owner**: Valentín Flórez Arbeláez
- **Epistemic state**: `WITHIN_TESTED_SCOPE`

---

## 2. Scope

Elevate `performance-talent-group` from `LEVEL_2_AUTHORIZED` to `LEVEL_3_PRODUCTION_AUTHORIZED` after revalidated git hygiene, secret scan, and live production reachability. Update registry HEAD pin to match `origin/main`.

Out of scope: mutating the sibling PTG tree in this change set.

---

## 3. Functional Requirements (EARS)

### FR-PTG-001: Clean Git Precondition (Event-Driven)

CUANDO se audita el checkout local de PTG para elevación Level 3, EL SISTEMA SHALL verificar working tree limpio y actualizar `headCommitSha` al HEAD verificado.

### FR-PTG-002: Secret Hygiene (Ubiquitous / Law VI)

EL SISTEMA SHALL exigir `scripts/eos-secret-scan.mjs` en solo-lectura sobre el sibling con **0** hallazgos antes de promover Level 3.

### FR-PTG-003: Live Production Probe (Event-Driven)

CUANDO se eleva a Level 3, EL SISTEMA SHALL comprobar que `https://ptg-performance-talent-group.vercel.app` responde HTTP 200 bajo política SSRF allowlist.

### FR-PTG-004: Registry Level 3 Promotion (Event-Driven)

CUANDO FR-PTG-001..003 y owner approval están sellados, EL SISTEMA SHALL actualizar `authorization` a `LEVEL_3_PRODUCTION_AUTHORIZED` y `ownerApproval` a `OWNER_APPROVAL`.

### FR-PTG-005: Fail-Closed Sibling Mutation Scope (Error)

SI una misión intenta escrituras unbounded al sibling sin evidencia acotada, ENTONCES EL SISTEMA SHALL fallar cerrado — Level 3 es elegibilidad write-gated, no mutación implícita.

---

## 4. Acceptance Criteria (BDD)

```gherkin
ESCENARIO: BDD-PTG-001: Working tree limpio
  DADO el checkout Performance-Talent-Group-1 en main
  CUANDO se consulta git status
  ENTONCES el working tree está limpio

ESCENARIO: BDD-PTG-002: Secret scan cero hallazgos
  DADO el directorio sibling PTG
  CUANDO se ejecuta eos-secret-scan.mjs
  ENTONCES exit code es 0 y findings = 0

ESCENARIO: BDD-PTG-003: Producción reachable
  DADO https://ptg-performance-talent-group.vercel.app
  CUANDO se ejecuta un probe HTTP HEAD allowlisted
  ENTONCES el status es 200

ESCENARIO: BDD-PTG-004: Promoción canónica Level 3
  DADO cumplimiento de BDD-PTG-001..003 y AUTH Level 3
  CUANDO se reconcilia docs/projects/registry.json
  ENTONCES authorization es LEVEL_3_PRODUCTION_AUTHORIZED
  Y ownerApproval es OWNER_APPROVAL
```
