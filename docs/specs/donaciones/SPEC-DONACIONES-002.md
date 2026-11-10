# SPEC-DONACIONES-002: Portal de Donaciones — Level 3 Governance Elevation

## 1. Specification Metadata

- **Spec ID**: `SPEC-DONACIONES-002` (project-scoped under `docs/specs/donaciones/`; **not** a new OpenSpec catalog id)
- **Project**: `donaciones`
- **Status**: `SPECIFICATION_APPROVED` (control-plane elevation contract)
- **Composes**: SPEC-DONACIONES-001, SPEC-100 / SPEC-124, SPEC-042, Law IV / Law VI
- **Standard**: IEEE 830 / ISO 29148 — formal EARS + BDD
- **Date**: `2026-11-09`
- **Owner**: Valentín Flórez Arbeláez
- **Epistemic state**: `WITHIN_TESTED_SCOPE`

---

## 2. Scope

Elevate registry governance for `donaciones` from `LEVEL_2_AUTHORIZED` to `LEVEL_3_PRODUCTION_AUTHORIZED` after revalidated git hygiene, secret scan, and live production reachability.

Out of scope: mutating the sibling `Donaciones` tree in the same change set; donation UX / payment rails.

---

## 3. Functional Requirements (EARS)

### FR-DON-101: Clean Git Precondition (Event-Driven)

CUANDO se audita el checkout local de `donaciones` para elevación Level 3, EL SISTEMA SHALL verificar working tree limpio y HEAD alineado con el pin del registry (o actualizar el pin con evidencia).

### FR-DON-102: Secret Hygiene (Ubiquitous / Law VI)

EL SISTEMA SHALL exigir `scripts/eos-secret-scan.mjs` en modo solo-lectura sobre el sibling con **0** hallazgos antes de promover Level 3.

### FR-DON-103: Live Production Probe (Event-Driven)

CUANDO se eleva a Level 3, EL SISTEMA SHALL comprobar que `https://donaciones-drab.vercel.app` responde HTTP 200 bajo política SSRF allowlist (`*.vercel.app`).

### FR-DON-104: Registry Level 3 Promotion (Event-Driven)

CUANDO FR-DON-101..103 y owner approval están sellados, EL SISTEMA SHALL actualizar `donaciones.authorization` a `LEVEL_3_PRODUCTION_AUTHORIZED` preservando `REGISTERED` / `INTAKE_COMPLETE` / `SPECIFICATION_APPROVED` / `AUDIT_COMPLETE` / `OWNER_APPROVAL`.

### FR-DON-105: Fail-Closed Sibling Mutation Scope (Error)

SI una misión intenta escrituras unbounded al sibling sin evidencia de misión acotada, ENTONCES EL SISTEMA SHALL fallar cerrado — Level 3 otorga elegibilidad write-gated, no mutación implícita en este cambio.

---

## 4. Acceptance Criteria (BDD)

```gherkin
ESCENARIO: BDD-DON-101: Working tree limpio para Level 3
  DADO el checkout local de Donaciones en main
  CUANDO se consulta git status
  ENTONCES el working tree está limpio
  Y HEAD coincide con el pin del registry (o el pin se actualiza con evidencia)

ESCENARIO: BDD-DON-102: Secret scan cero hallazgos
  DADO el directorio sibling Donaciones
  CUANDO se ejecuta eos-secret-scan.mjs en solo lectura
  ENTONCES exit code es 0
  Y findings = 0

ESCENARIO: BDD-DON-103: Producción reachable
  DADO https://donaciones-drab.vercel.app
  CUANDO se ejecuta un probe HTTP HEAD allowlisted
  ENTONCES el status es 200

ESCENARIO: BDD-DON-104: Promoción canónica Level 3
  DADO cumplimiento de BDD-DON-101..103 y AUTH Level 3
  CUANDO se reconcilia docs/projects/registry.json
  ENTONCES donaciones.authorization es LEVEL_3_PRODUCTION_AUTHORIZED
  Y ownerApproval permanece OWNER_APPROVAL
```
