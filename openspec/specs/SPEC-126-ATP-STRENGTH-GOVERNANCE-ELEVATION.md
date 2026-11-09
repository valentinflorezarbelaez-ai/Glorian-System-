# SPEC-126: ATP Strength & Hypertrophy Platform Governance Elevation (Level 3)

## 1. Metadata & Status

- **Specification ID**: `SPEC-126`
- **Title**: `ATP Strength & Hypertrophy Platform Governance Elevation (Level 3)`
- **Version**: `1.0.0`
- **Status**: `APPROVED`
- **Author**: `Valentín Flórez Arbeláez (Principal Architect) & Antigravity (EOS Agent)`
- **Date**: `2026-11-02`
- **Epistemic State**: `SPECIFICATION_APPROVED`
- **Constitutional Alignment**: `EOS Constitution Laws I, II, III, IV, VI, VII`

---

## 2. Executive Context & Objective

`ATP-STRENGTH-1` is an athletic performance, volume tracking, and sports nutrition monolith deployed at `https://atp-strength.vercel.app`. Currently marked as `LEVEL_1_READ_ONLY` in `docs/projects/registry.json`, this specification defines the formal elevation to `LEVEL_3_PRODUCTION_AUTHORIZED`, validating:

1. Working tree cleanliness and branch synchronization (`origin/main`).
2. Zero secret leaks via `scripts/eos-secret-scan.mjs`.
3. Live HTTP 200 reachability and SSL security on `https://atp-strength.vercel.app`.
4. Updating `status: REGISTERED`, `intake: INTAKE_COMPLETE`, `specification: SPECIFICATION_APPROVED`, `audit: AUDIT_COMPLETE`, `authorization: LEVEL_3_PRODUCTION_AUTHORIZED`, and `ownerApproval: OWNER_APPROVAL`.

---

## 3. Functional Requirements (IEEE 830 / EARS)

### FR-393: Git Repository Verification

CUANDO se audita `ATP-STRENGTH-1`, EL SISTEMA debe verificar que el repositorio Git local no tenga modificaciones no registradas y esté sincronizado con `origin/main`.

### FR-394: Secret Hygiene Conformance (Law VI)

CUANDO se ejecuta el escáner de secretos canónico sobre `ATP-STRENGTH-1`, EL SISTEMA debe reportar 0 credenciales ni tokens en texto plano expuestos en el código fuente.

### FR-395: Live Production Health Verification

EL SISTEMA debe comprobar que el endpoint `https://atp-strength.vercel.app` responde con código HTTP 200 y latencia menor a 1000ms.

### FR-396: Level 3 Registry Promotion

CUANDO se cumplen FR-393, FR-394 y FR-395, EL SISTEMA debe actualizar el registro canónico `docs/projects/registry.json` promoviendo `atp-strength` a `LEVEL_3_PRODUCTION_AUTHORIZED` con firma SHA-256 recalculada.

---

## 4. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-375 Verificación de Repositorio Limpio en ATP Strength
  DADO el directorio "c:\Users\valen\ATP-STRENGTH-1"
  CUANDO se consulta su estado Git
  ENTONCES el working tree está limpio y en la rama "main".

ESCENARIO: BDD-376 Auditoría de Secretos en ATP Strength
  DADO el directorio "c:\Users\valen\ATP-STRENGTH-1"
  CUANDO se ejecuta "scripts/eos-secret-scan.mjs" en modo de solo lectura
  ENTONCES reporta 0 secretos detectados (exit code 0).

ESCENARIO: BDD-377 Sondeo de Producción en ATP Strength
  DADO el dominio "https://atp-strength.vercel.app"
  CUANDO se realiza una solicitud de sondeo HTTP HEAD
  ENTONCES retorna status 200 y tiempo de respuesta inferior a 1000ms.

ESCENARIO: BDD-378 Promoción Canónica a Nivel 3 en el Registro
  DADO el cumplimiento de los escenarios anteriores
  CUANDO se reconcilia el registro de flota
  ENTONCES "atp-strength" registra "LEVEL_3_PRODUCTION_AUTHORIZED" y "OWNER_APPROVAL".
```
