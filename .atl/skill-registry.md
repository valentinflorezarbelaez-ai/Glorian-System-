# Agent-Teams-Lite & Judgment-Day Project Skill Registry — Glorian / EOS System (v75.0.0)

## Project Metadata

- **Project**: `eos-system` (`Glorian System — Engineering Operating System`)
- **Runtime**: Node.js `>=24.0.0` (native strip-only TypeScript + `node:sqlite` WAL/FTS5)
- **Co-Governance**: `eos-system` MCP Control Plane + Gentle AI Stack (`gentle-ai`, `engram 3.7.1`, `gga`, `context7`, `agent-teams-lite`)
- **Fleet Scope**: 9/9 Sovereign Fleet Repositories with OpenSpec & MCP Integration (`Aberamentho-s-Pleroma-music`, `ATP-STRENGTH-1`, `Biblioteca-gnostica-1`, `Control-De-Asistencia-Abopack`, `Crud-slack`, `Donaciones`, `Glorian-System`, `Performance-Talent-Group-1`, `portafolio`)

## Compact Rules (Auto-Injected into Sub-Agents & Judgment-Day Blind Judges)

### `src/core/*.ts` (Layer-0 Pure Domain Kernel)

- **Zero External Runtime Dependencies (Law V)**: Only `node:*` built-in modules and relative Layer-0 imports (`./*`) are permitted. `package.json` `"dependencies"` must remain empty (`0`).
- **Node 24 Strip-Only TypeScript**: Never use `enum`, `namespace`, or constructor parameter properties (`constructor(private x: number)`). Use string-literal union types and explicit class fields.
- **Design by Contract**: Validate inputs with `assertPrecondition`, verify invariants with `assertPostcondition`, freeze outputs with `deepFreeze`, and seal audit outputs with 64-char `pureSha256` receipts.

### `src/mcp/*.ts` (Layer-1 MCP Control Plane)

- **Strict Path Confinement (FR-132)**: Every tool accepting a filesystem path MUST resolve and confine via `resolveProjectPath()` relative to `this.projectRoot` (never `process.cwd()`).
- **MCP 2025-03-26 Annotations (FR-133)**: Every exposed tool must carry accurate `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- **Zero Plaintext Secrets (Law VI)**: Never log, echo, or commit tokens, API keys, or stack traces.

### `openspec/**` & `docs/**` (SDD Constitutional Artifacts)

- **EARS & BDD Compliance (Laws I & II)**: Functional requirements must follow formal EARS patterns; acceptance criteria must use `ESCENARIO / DADO / CUANDO / ENTONCES / Y` and map 1:1 to `test/*.test.mjs`.
- **Artifact Language (Law VII)**: Write all code, comments, identifiers, schemas, ADRs, and commit messages in standard professional English.

### `modern-web-guidance` (HTML/CSS/client-side JS)

- **Mandatory first step** for HTML/CSS and client-side JS UI work: `npx -y modern-web-guidance@latest search "<2-5 word query>"` then `retrieve "<id>"` before inventing patterns.
- Keep queries focused on one UI/platform capability; omit framework/app nouns; split compound features into separate searches.
- **Never** add `modern-web-guidance` to `package.json` dependencies/devDependencies; skill lives under `.agents/skills/modern-web-guidance/` + `skills-lock.json`.
- **Layer-0 purity**: `src/core/` must not import or reference MWG; runtime `dependencies` stay empty.
- Baseline Widely available features need no custom fallbacks; non-Baseline features must follow the guide's fallback recommendations.
- Fail-closed: `npm run mwg:gate` (wired into `verify:strict`). Runbook: `docs/runbooks/modern-web-guidance.md`.

### `software-factory` (LIDR optional orchestration)

- Compose existing skills only (`sdd-*`, `gdd-contract`, `judgment-day`, `issue-creation`, `branch-pr`); do not reinvent protocols.
- Isolate Apply work in `.worktrees/` via `node scripts/software-factory-worktree.mjs` (fail-closed; no paths outside `.worktrees/`).
- Plan ≠ Execute: planner must not be the Apply agent; builder ≠ verifier.
- Stop on attempt caps / judgment-day escalation; never rewrite tests/CI/check to pass.
- Evidence: `npm run verify:strict` exit 0. Outside Layer-0 — no new runtime deps.

## Active Skills Roster

| Skill                   | Role                                        | Primary Command / Trigger                         |
| ----------------------- | ------------------------------------------- | ------------------------------------------------- |
| `eos-director`          | Control plane engineering director          | Antigravity director, EOS architecture            |
| `eos-fleet-ops`         | Multi-repo fleet operations                 | Fleet audits, canary rollout, worktree governance |
| `eos-gentleman-synergy` | Unification protocol: EOS + Gentle AI Stack | Gentleman Stack alignment, Engram, GGA            |
| `eos-sdd-pipeline`      | 21-Step Master SDD Pipeline                 | Master engineering specification gate             |
| `judgment-day`          | Blind dual-judge adversarial review         | "judgment day", "doble review", adversarial audit |
| `sdd-init`              | Initialize SDD context in project           | `sdd init`, bootstrap openspec + engram           |
| `sdd-explore`           | Pre-proposal codebase exploration           | Feature exploration and design inquiry            |
| `sdd-propose`           | Change proposal creation                    | Change proposal with intent, scope, approach      |
| `sdd-spec`              | EARS & BDD specification creation           | Delta specs, requirements, scenario drafting      |
| `sdd-design`            | Architecture design & ADR record            | Technical design and architectural decisions      |
| `sdd-tasks`             | Atomic DAG checklist decomposition          | Implementation checklist and task DAG             |
| `sdd-apply`             | Code implementation of task DAG             | Code generation against approved specs            |
| `sdd-verify`            | Verification against specs & design         | Compliance validation and scenario assertion      |
| `sdd-archive`           | Change consolidation & delta sync           | Spec archival and main spec consolidation         |
| `branch-pr`             | Issue-first PR workflow                     | Safe Git branch and pull request generation       |
| `issue-creation`        | Issue creation and traceability             | GitHub issue creation and bug reports             |
| `modern-web-guidance`   | Google Chrome Modern Web Guidance           | Search/retrieve modern HTML/CSS/JS best practices |
| `gdd-contract`          | Goal-Driven Development measurable Done     | Goal schema, caps, `goal:validate`                |
| `software-factory`      | Optional LIDR factory orchestration         | `/factory`, worktrees, Plan→Apply, judgment-day   |
| `skill-registry`        | Skill inventory synchronizer                | Update registry, sync with Engram                 |
