# Agent-Teams-Lite & Judgment-Day Project Skill Registry — EOS System (v50.0.0)

## Project Metadata
- **Project**: `eos-system` (`EOS System — Engineering Operating System`)
- **Runtime**: Node.js `>=22.0.0` (native strip-only TypeScript + `node:sqlite` WAL/FTS5)
- **Co-Governance**: `eos-system` MCP + Gentle AI Stack (`gentle-ai`, `engram`, `gga`, `context7`, `agent-teams-lite`)

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
