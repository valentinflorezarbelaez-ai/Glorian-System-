---
name: eos-sdd-pipeline
description: Enforces the EOS 21-Step Specification-Driven Development (SDD) pipeline with IEEE 830 EARS requirements, Gherkin BDD scenarios, ADRs, TLA+ bounded simulations, and Level 2+ authorization gates. Use before implementing new features or architectural changes.
---

# EOS 21-Step Specification-Driven Development (SDD) Pipeline

Under **Law I (Zero Vibe Coding)** and **Law II (The Strict Gate)**, zero lines of production implementation code may be written until the complete specification package is formalized and authorized.

## 1. Strict Pre-Code Specification Package

Before creating or modifying production modules under `src/`, `api/`, or `bin/`:

1. **Amplify Requirements via MCP (`eos_amplify_prompt`)**
   Call `eos_amplify_prompt` on `eos-system`:
   ```json
   {
     "ServerName": "eos-system",
     "ToolName": "eos_amplify_prompt",
     "Arguments": {
       "rawPrompt": "<feature description>",
       "targetModel": "gemini",
       "strictLevel": "sovereign"
     }
   }
   ```
2. **Author the 6 Constitutional Artifacts**
   - **Intake**: `docs/intake/<project>/INTAKE-XXX-<SLUG>.md`
   - **OpenSpec (EARS + BDD)**: `openspec/specs/SPEC-XXX-<SLUG>.md` and `openspec/changes/CHANGE-XXX-<SLUG>.md`
     - Every Functional Requirement (`FR-XXX`) uses formal EARS patterns (`CUANDO ... EL SISTEMA ...`, `MIENTRAS ...`, `SI ... ENTONCES ...`, `EL SISTEMA ...`).
     - Every Acceptance Criterion (`BDD-XXX`) uses `ESCENARIO / DADO / CUANDO / ENTONCES / Y`.
   - **Architecture Plan & ADR**: `docs/plans/PLAN-XXX-<SLUG>.md` documenting rejected alternatives and Layer-0 hexagonal isolation.
   - **Atomic Task DAG**: `docs/tasks/TASKS-XXX-<SLUG>.md` with explicit done-criteria per task.
   - **Formal Model (for Control-Plane / Concurrency / Security protocols)**: `docs/formal/<ModelName>.tla` paired with a bounded deterministic simulation in `scripts/verify-formal-tla.mjs`.
   - **Authorization Record**: Entry in `IMPLEMENTATION_AUTHORIZATION.md` (`LEVEL 2` or `LEVEL 3`).

## 2. Clean / Hexagonal Layer-0 Implementation Rules (Law V & Law VII)

- **Zero External Runtime Dependencies**: `package.json` `"dependencies"` must remain empty (`0` packages). Use only Node.js built-ins (`node:fs`, `node:crypto`, `node:path`, `node:http`, etc.) and Layer-0 primitives (`src/core/eosKernelPrimitives.ts`).
- **Node 24 Strip-Only TypeScript Compatibility**: Do not use TypeScript `enum`, `namespace`, or constructor parameter properties (`constructor(private x: number)`). Use string literal union types and explicit class fields.
- **Design by Contract (DbC)**: Guard public domain methods with `assertPrecondition`, `assertPostcondition`, `deepFreeze`, and `pureSha256` receipts.
- **English Artifacts**: Write all code, identifiers, comments, specs, ADRs, and commit messages in professional English.

## 3. Verification Sequence

1. Run `eos_check_openspec` and `eos_simulate_bounded_models` via `call_mcp_tool` (`ServerName: "eos-system"`).
2. Run `npm run typecheck` (`tsc --project tsconfig.typecheck.json`) — treat any warning or error as blocking.
3. Add a dedicated `node:test` suite `test/<feature>.test.mjs` covering every `BDD-XXX` scenario.
4. Run `npm run test` (`scripts/verify-cicd-pipeline.mjs`) and confirm all 7/7 stages exit with code `0`.
