# INTAKE-001: Donaciones — Control-Plane Fleet Onboarding (Law IV)

- **Project**: `donaciones` (Portal de Donaciones — Sede AGEAC & Tercer Factor)
- **Date**: 2026-11-09
- **Owner**: Valentín Flórez Arbeláez
- **Status**: `INTAKE_COMPLETE`
- **Epistemic state**: `PRODUCTION_READY_WITHIN_TESTED_SCOPE` for control-plane onboarding; registry `LEVEL_2_AUTHORIZED` (sibling write barrier still fail-closed)
- **Catalog rule**: Prefer composing existing SPECs (100/124/042). Project-scoped `SPEC-DONACIONES-001` (no new OpenSpec catalog id).

---

## 1. Gap (why scorecard grade is F)

Registry posture is intentionally fail-closed:

| Field | Current | Blocks scorecard |
| --- | --- | --- |
| `intake` | `PENDING_INTAKE` | yes (`specCoverage`) |
| `specification` | `PENDING_SPECIFICATION` | yes (`specCoverage`) |
| `audit` | `PENDING_AUDIT` | yes (`gatePassRate`) |
| `authorization` | `LEVEL_1_READ_ONLY` | yes (`mutationFloor`) |

Sibling repo already has local `IMPLEMENTATION_AUTHORIZATION.md` (`LEVEL 2`) and production URL `https://donaciones-drab.vercel.app`. Control-plane registry must not copy that status until Law IV preconditions are sealed here.

## 2. Observed facts (evidence, not claims)

1. Vercel project `donaciones` latest production URL: `https://donaciones-drab.vercel.app` (reachable `200` when DNS resolves).
2. Local checkout under workspace `Donaciones` is a **static** site (`index.html` + `vercel.json`, **no** `package.json`).
3. Fleet path resolver previously required `package.json`, so dogfood recorded `SKIPPED_SIBLING` even with a real checkout. Remediation: treat `.git` + (`package.json` **or** `index.html`+`vercel.json`) as usable; empty `.git` residue stays skipped.
4. Scorecard must stay **F** until intake + specification + audit + `LEVEL_2+` are completed — no grade inflation.

## 3. Law IV ladder (ordered)

1. **Intake** — this document → owner marks `INTAKE_COMPLETE` only after review.
2. **Specification** — bilingual EARS/BDD under `docs/specs/donaciones/` composing fleet SPECs (no new catalog id unless unlock + need proven).
3. **Audit** — secret scan, SSRF allowlist URL, static deploy markers, HEAD SHA pin.
4. **Owner approval** — decision log entry.
5. **Authorization** — promote registry to `LEVEL_2_AUTHORIZED` only after 1–4; never from sibling markdown alone.

## 4. Non-goals

- Do not mutate the `Donaciones` repository from the control plane (`Δ = 0` until Level 2+ write barrier clears).
- Do not invent OpenSpec ids past the freeze policy without dogfood evidence.
- Do not raise scorecard grades by editing JSON scores.

## 5. Next executable steps

1. [x] Merge static-checkout path resolver + tip evidence refresh (#614).
2. [x] Dogfood `FLOW_INSPECT:donaciones` SUCCESS with workspace root.
3. [x] Seal intake + `SPEC-DONACIONES-001` + `AUDIT-DONACIONES-001` in control plane.
4. [x] Owner directive → registry `LEVEL_2_AUTHORIZED` + `OWNER_APPROVAL` (AUTH-2026-11-09-DONACIONES-LAW-IV-LEVEL-2).
5. [ ] Configure Actions secrets (`VERCEL_TOKEN`, optional project/team, `EOS_FLEET_CHECKOUT_TOKEN`) for live ACA path.
6. [ ] Separate Level 3 ritual before any control-plane write into sibling `Donaciones` (`Δ = 0` until then).
