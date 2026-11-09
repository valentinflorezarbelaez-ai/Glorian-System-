# Design Specification: Glorian System Dual-Stack Rebranding

**Date:** 2026-11-02  
**Topic:** System Identity Elevation from EOS System to Glorian  
**Status:** PROPOSED (Awaiting User Approval)  
**Specification Reference:** SPEC-130 / CHANGE-068

---

## 1. Intent and Why

The system identity is being elevated from "EOS System" to **"Glorian"** (or **"Glorian System"**), aligning the platform with the sacred solar light and transcendent theurgic principles of the Glorián. The transition must be seamless, establishing "Glorian" as the primary public, visual, and terminal identity while preserving technical aliases to guarantee zero downtime and zero breaking changes across existing tooling, fleet repositories, and MCP client hooks.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

1. **Public & UI Elevation:** Rebrand all public-facing titles, meta tags, OpenGraph cards, Schema.org descriptors, and UI console headers in `index.html` and `src/ui/eosStudioConsole.html` to **Glorian System** / **Glorian**.
2. **Dual-Stack CLI Command:** Add `"glorian"` to the `bin` field in `package.json` pointing to `bin/eos.mjs`, establishing `glorian <command>` as the primary CLI while retaining `eos <command>` as an alias.
3. **Master Catalog & Documentation:** Update `README.md`, `AGENTS.md`, and `docs/projects/registry.json` to reflect "Glorian (Control Plane Core)".
4. **Strict Verification:** Recalculate SRI integrity hashes and execute CI/CD verification suites (`scripts/verify-sri-integrity.mjs`, `npm test`) ensuring 0 broken invariants and 100% pass rate.

### Non-Goals

1. Renaming internal TypeScript source files or class names (e.g., `EosEliteDesignStudioEngine.ts`, `EosS0DesignSystemGovernor.ts`).
2. Renaming existing MCP tool definitions (`eos_*`) or breaking established protocol contracts.
3. Renaming environment variables (e.g., `EOS_FLEET_*`).

### Anti-Goals

1. Breaking external CI/CD hooks or satellite repositories that call `eos`.
2. Causing layout shifts or SRI hash mismatches on the production landing page.

---

## 3. Constraints

- **Layer 0 Purity:** No new npm runtime dependencies.
- **Integrity Gate:** SRI (Subresource Integrity) SHA-384 hashes in `index.html` must be validated and synchronized.
- **Backward Compatibility:** All existing commands (`eos init`, `eos verify`, `eos mcp`) must continue to function identically alongside `glorian`.

---

## 4. Approaches Evaluated

| Approach                            | Description                                                                                                 | Trade-offs                                                                | Verdict                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| **Enfoque 1: Dual-Stack Rebrand**   | Rebrand UI, docs, and catalog; register `glorian` CLI in `package.json` with `eos` alias; verify integrity. | Full brand elevation across UI and terminal; zero regression risk.        | **SELECTED (User Approved)** |
| **Enfoque 2: Presentation-Only**    | Only change text strings in HTML and README; no `package.json` CLI change.                                  | Disconnect between visual brand ("Glorian") and terminal command (`eos`). | REJECTED                     |
| **Enfoque 3: Destructive Refactor** | Rename every class, file, MCP tool (`glorian_*`), and environment variable.                                 | Extreme blast radius across 176 MCP tools and 9 fleet projects.           | REJECTED                     |

---

## 5. Architectural Changes & File Manifest

1. **`package.json`**:
   - Update `bin` section:
     ```json
     "bin": {
       "glorian": "bin/eos.mjs",
       "eos": "bin/eos.mjs"
     }
     ```
2. **`index.html`**:
   - Update `<title>Glorian System — Flujo local para revisar cambios de código</title>`
   - Update `<meta name="application-name" content="Glorian System" />`
   - Update `<meta name="apple-mobile-web-app-title" content="Glorian" />`
   - Update OpenGraph, Twitter, and Schema.org metadata to "Glorian System".
   - Update Hero Bento HUD and visible headings from "EOS SYSTEM" to "GLORIAN SYSTEM".
3. **`src/ui/eosStudioConsole.html`**:
   - Update `<title>Glorian System — Sovereign Studio Console</title>`
   - Update header `<h1>GLORIAN SYSTEM // MATRIX v19.0</h1>`
4. **`AGENTS.md` & `README.md`**:
   - Update Component Title to `Glorian System (formerly EOS System)`.
5. **`docs/projects/registry.json`**:
   - Update project `id: "eos-system"` display name to `"Glorian (Control Plane Core)"`.
6. **Integrity & Verification**:
   - Run `node scripts/verify-sri-integrity.mjs`.
   - Run `npm test` and `node scripts/verify-cicd-pipeline.mjs`.

---

## 6. Execution Plan

Upon explicit approval of this design document:

1. Invoke `superpowers:writing-plans` to create the atomic task DAG in `docs/plans/PLAN-130-GLORIAN-DUAL-STACK-REBRAND.md`.
2. Execute the changes atomically.
3. Validate and verify with test suites.
