# SPEC-DONACIONES-001: Portal de Donaciones — Control-Plane Fleet Contract

## 1. Specification Metadata

- **Spec ID**: `SPEC-DONACIONES-001` (project-scoped under `docs/specs/donaciones/`; **not** a new OpenSpec catalog id)
- **Project**: `donaciones` (Portal de Donaciones — Sede AGEAC & Tercer Factor)
- **Status**: `SPECIFICATION_APPROVED` (control-plane contract)
- **Composes**: SPEC-100 / SPEC-124 (fleet registry), SPEC-042 (soundcheck), Law IV External Write Barrier
- **Standard**: IEEE 830 / ISO 29148 — formal EARS + BDD
- **Date**: `2026-11-09`
- **Owner**: Valentín Flórez Arbeláez
- **Epistemic state**: `WITHIN_TESTED_SCOPE`

---

## 2. Scope

Control-plane obligations for registering, probing, and dogfooding the static Vercel sibling `donaciones` without mutating the sibling repository (`Δ = 0` while `LEVEL_1_READ_ONLY`).

Out of scope: changing donation UX, payment rails, or sibling application logic.

---

## 3. Functional Requirements (EARS)

### FR-DON-001: Registry Binding (Ubiquitous)

EL SISTEMA SHALL keep `donaciones` in `docs/projects/registry.json` with `status=REGISTERED`, `productionUrl` HTTPS on `*.vercel.app`, and `resolvedLocalDir` / `localPathEnv` resolvable without machine-absolute paths in source (Law VI).

### FR-DON-002: Static Checkout Usability (Event-Driven)

CUANDO el path resolver evalúa un checkout local de `donaciones`, EL SISTEMA SHALL marcar `AVAILABLE` si existe `.git` y (`package.json` **o** `index.html` + `vercel.json`); SI solo existe residuo `.git` vacío, ENTONCES SHALL marcar `SKIPPED_SIBLING`.

### FR-DON-003: Live Probe SSRF Shield (Error)

SI `EOS_FLEET_SCORECARD_PROBE=1` y la URL no es HTTPS `*.vercel.app` (o viola política SSRF), ENTONCES EL SISTEMA SHALL denegar I/O de red con `REJECTED_HOST` / `REJECTED_SCHEME` y no inflar `liveReachability`.

### FR-DON-004: Law IV Fail-Closed Writes (Error)

SI `authorization` es `LEVEL_1_READ_ONLY` o faltan intake/spec/audit/owner approval, ENTONCES EL SISTEMA SHALL rechazar escrituras al directorio sibling `Donaciones` (`LAW_IV_INCOMPLETE`).

### FR-DON-005: Scorecard Honesty (Ubiquitous)

EL SISTEMA SHALL derivar la scorecard de donaciones solo de campos de gobernanza del registry (+ probe opcional); PROHIBIDO editar `score`/`grade` a mano para aparentar adopción.

### FR-DON-006: Dogfood Flow Inspect (Event-Driven)

CUANDO `npm run fleet:dogfood` corre con checkout usable, EL SISTEMA SHALL emitir `FLOW_INSPECT:donaciones` con `status=SUCCESS` o `SKIPPED_SIBLING` explícito, nunca un falso `AVAILABLE` por residuo git.

---

## 4. Non-Functional Requirements

1. **NFR-DON-001**: Sibling is static (HTML/CSS/JS + `vercel.json`); control plane must not require npm deps inside Donaciones.
2. **NFR-DON-002**: Production URL allowlisted for scorecard probes: `https://donaciones-drab.vercel.app`.
3. **NFR-DON-003**: Zero plaintext secrets in control-plane artifacts; sibling `.env.local` never committed from this plane.

---

## 5. Acceptance Criteria (BDD)

```gherkin
ESCENARIO: BDD-DON-001: Checkout estático usable
  DADO un directorio con .git, index.html y vercel.json sin package.json
  CUANDO resolveFleetProjectPath evalúa donaciones vía resolvedLocalDir
  ENTONCES status es AVAILABLE
  Y resolution es RESOLVED_LOCAL_DIR o ENV

ESCENARIO: BDD-DON-002: Residuo git vacío fail-closed
  DADO un directorio que solo contiene .git
  CUANDO resolveFleetProjectPath evalúa ese id
  ENTONCES status es SKIPPED_SIBLING
  Y path es null

ESCENARIO: BDD-DON-003: Scorecard no se infla en LEVEL_1
  DADO registry donaciones con authorization LEVEL_1_READ_ONLY
  CUANDO se construye la fleet product scorecard
  ENTONCES mutationFloor refleja auth incompleta
  Y grade no se fuerza a A por edición manual
```
