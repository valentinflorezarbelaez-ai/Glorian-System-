# INTAKE-002: Donaciones — Level 3 Production Elevation (Law IV)

- **Project**: `donaciones` (Portal de Donaciones — Sede AGEAC & Tercer Factor)
- **Date**: 2026-11-09
- **Owner**: Valentín Flórez Arbeláez
- **Status**: `INTAKE_COMPLETE`
- **Prerequisite**: `INTAKE-001` + `SPEC-DONACIONES-001` + `AUDIT-DONACIONES-001` + AUTH Level 2 sealed
- **Epistemic state**: `PRODUCTION_READY_WITHIN_TESTED_SCOPE` for control-plane Level 3 registry elevation
- **Catalog rule**: Project-scoped `SPEC-DONACIONES-002` (no new OpenSpec catalog id; freeze ≤ SPEC-185)

---

## 1. Gap (why Level 3)

| Field           | Current (Level 2)     | Target (Level 3)                    |
| --------------- | --------------------- | ----------------------------------- |
| `authorization` | `LEVEL_2_AUTHORIZED`  | `LEVEL_3_PRODUCTION_AUTHORIZED`     |
| Write barrier   | Fail-closed sibling Δ | Write-gated eligibility on registry |

Level 2 sealed control-plane onboarding. Level 3 unlocks write-gated dogfood / fleet eligibility without implying unbounded sibling mutation in this change set.

## 2. Observed facts (evidence, not claims)

1. Git HEAD pin matches registry: `2f45b0ab86c70e00066d6d442690c446942d3cf4` on `main` (clean working tree).
2. Canonical secret scan: `node scripts/eos-secret-scan.mjs --target <Donaciones>` → **PASS**, 18 files, 0 plaintext secrets.
3. Production probe: `HEAD https://donaciones-drab.vercel.app` → **HTTP 200**.
4. Fleet Soundcheck: `donaciones` grade A+ / 100 (2026-11-10).
5. Owner directive 2026-11-09: continue absolute-max EngProd after Level 2 (“continuemos”).

## 3. Law IV ladder (Level 3)

1. **Intake** — this document.
2. **Specification** — `SPEC-DONACIONES-002` (EARS/BDD elevation contract).
3. **Audit** — `AUDIT-DONACIONES-002` revalidation (git / secrets / live URL).
4. **Owner approval** — AUTH Level 3 record.
5. **Authorization** — promote `docs/projects/registry.json` → `LEVEL_3_PRODUCTION_AUTHORIZED`.

## 4. Non-goals

- This intake does **not** mutate files inside the sibling `Donaciones` repository (`Δ = 0` in this ritual).
- Does not authorize payment/UX product changes.
- Does not invent OpenSpec ids past the catalog freeze.

## 5. Next executable steps

1. [x] Revalidate HEAD / secrets / live probe.
2. [x] Seal `SPEC-DONACIONES-002` + `AUDIT-DONACIONES-002` + AUTH Level 3.
3. [x] Promote registry authorization to `LEVEL_3_PRODUCTION_AUTHORIZED`.
4. [ ] Any future sibling write remains a **scoped** mission with its own evidence — Level 3 is eligibility, not a blank cheque.
