# ODD Feature: Glorian Engine Big-Tech Hardening (Ordered T1-T4)

Objective: Execute the four approved Principal/Distinguished-Engineer Glorian engine upgrades strictly in order while keeping `dependencies: {}`, `<= 788` lines per module, and zero modifications to sealed landing assets.
Branch: `feat/glorian-engine-bigtech-hardening` | Delivery: `ask-on-risk` (forecast ~480 authored changed lines across 4 work-unit commits) | Runner: `node --test`

## Specs

- **S1 — Canonical AST Module-Syntax Extraction (`SPEC-044`, `SPEC-270`)**:
  - User request verbatim: `"si vamos en orden como harian los mejores la landing no la toque nunca mas solo el motor de glorian solo eso vamos como harian los mas grandes"`
  - Scope: `src/core/eosTypeScriptAstAnalyzer.ts`, `src/core/eosTypeScriptAstAnalyzer.types.ts`, `src/core/eosSemanticGraph.ts`, `src/core/eosArchitectureGuard.ts`, `scripts/import-boundary-gate.mjs`, `scripts/verify-module-consumers.mjs`, and AST/graph unit tests. Never touch `index.html`, `css/eos.css`, `js/eos.js`, `js/eos-openspecs.js`, `sw.js`, or `manifest.webmanifest`.
  - Acceptance: Expose deterministic `extractModuleSyntax(source)` on `eosTypeScriptAstAnalyzer.ts` powered by `tokenizeTypeScriptAstStream` (extracting static `import`, side-effect `import`, multiline `import { ... } from`, `export * from`, `export { ... } from`, `export { ... }`, dynamic `import()`, and `require()` while ignoring `//` comments, `/* ... */` block comments, string literals, regex literals, and template literal prose). Route `import-boundary-gate.mjs`, `verify-module-consumers.mjs`, `eosArchitectureGuard.ts`, and `eosSemanticGraph.ts` through `extractModuleSyntax` with `636/636` consumer density intact.
  - Checks: `node --test test/eosTypeScriptAstAnalyzer.test.mjs test/eosSemanticGraph.test.mjs`, `npm run boundary:check`, `npm run consumers:audit`.

- **S2 — Deterministic Crash-Safety & Fault-Injection for `eos flow` and `eos sandbox` (`SPEC-250`, `SPEC-342`)**:
  - User request verbatim: `"si vamos en orden como harian los mejores la landing no la toque nunca mas solo el motor de glorian solo eso vamos como harian los mas grandes"`
  - Scope: `src/core/eosEngineeringWorkflow.ts`, `src/core/eosContainerSandbox.ts`, `src/core/eosContainerSandbox.types.ts`, `test/eosEngineeringWorkflow.test.mjs`.
  - Acceptance: Harden `.eos/workflows/<id>.json` persistence in `eosEngineeringWorkflow.ts` with `fsyncSync` before atomic rename, bounded Windows `EPERM`/`EBUSY` rename retry, tamper-evident `recordDigestSha256` verification, fail-closed corruption diagnostics (no raw `SyntaxError`), and idempotent post-merge crash recovery when `HEAD === reviewedHead` before record seal. Harden `eosContainerSandbox.ts` post-run symlink rejection (before exclusion skip) and make `applyWorkspaceChanges` two-phase preflight-validated with full in-memory rollback if any file write/unlink fails mid-flight. Add deterministic fault-injection tests covering truncated state JSON, 1-bit digest/hash tampering, concurrent `main` drift between `review` and `apply`, post-merge crash recovery, and mid-apply rollback.
  - Checks: `node --test test/eosEngineeringWorkflow.test.mjs test/eosFlowCliSmoke.test.mjs`.

- **S3 — gVisor (`runsc`) Sandbox Runtime, Hermetic SEA Config & Supply-Chain Provenance (`SPEC-061`, `SPEC-098`, `SPEC-198`, `SPEC-304`)**:
  - User request verbatim: `"si vamos en orden como harian los mejores la landing no la toque nunca mas solo el motor de glorian solo eso vamos como harian los mas grandes"`
  - Scope: `src/core/eosContainerSandbox.ts`, `src/core/eosContainerSandbox.types.ts`, `bin/commands/cliSpotify.mjs`, `bin/commands/cliHelpCatalog.mjs`, `sea-config.json`, `src/core/eosSingleExecutableDistributionGovernor.ts`, `.github/workflows/eos-sovereign-cicd.yml`, and corresponding tests.
  - Acceptance: Add `--runtime=runc|runsc|auto` to `eos sandbox run` (passing `--runtime=runsc` to Docker when selected or auto-detected, failing closed on invalid runtime names) and report `runsc` runtime availability in `eos sandbox doctor`. Point `sea-config.json` to CJS `bin/sea-bootstrap.cjs` so Node `--experimental-sea-config` builds a real SEA blob cleanly; route `eosSingleExecutableDistributionGovernor.ts` receipt output via `resolveEvidencePath`; extend `slsa-sbom-gate` / `slsa-provenance` in `.github/workflows/eos-sovereign-cicd.yml` to verify `supply-chain:bind -- --verify-only`, build/smoke-check the SEA blob, and attest `sbom.l0.cdx.json` + `provenance.intoto.jsonl`.
  - Checks: `node --test test/eosSingleExecutablePackager.test.mjs test/eosSingleExecutableDistributionGovernor.test.mjs test/eosHermeticSeaCompiler.test.mjs test/eosSlsaProvenanceSbom.test.mjs`.

- **S4 — O(1) CLI Dispatch, Lazy MCP Server Boot & `SPEC-342` Verification Honesty (`SPEC-068`, `SPEC-250`, `SPEC-290`, `SPEC-342`)**:
  - User request verbatim: `"si vamos en orden como harian los mejores la landing no la toque nunca mas solo el motor de glorian solo eso vamos como harian los mas grandes"`
  - Scope: `bin/eos.mjs`, `bin/commands/cliPlatform.mjs`, `bin/commands/cliMesh.mjs`, `src/mcp/eosMcpServer.ts`, `src/core/eosTreeSitterWasmEngine.ts`, `test/eosTreeSitterWasmEngine.test.mjs`, `test/glorianCliBinary.test.mjs`, `test/eosMcpTier0TokenEconomy.test.mjs`, `IMPLEMENTATION_AUTHORIZATION.md`.
  - Acceptance: Replace sequential 9-module waterfall in `bin/eos.mjs` and 23-module eager waterfall in `bin/commands/cliMesh.mjs` with O(1) command dispatch while preserving 100% `HANDLERS[...]` catalog parity (`<= 788` lines everywhere). Defer `ensureCorpusIndexed()` and `kg.syncGraph()` in `src/mcp/eosMcpServer.ts` until a tool actually queries hybrid RAG or the knowledge graph, keeping default `core` (`46` tools) and `essential` (`18` tools) contracts intact. Align `src/core/eosTreeSitterWasmEngine.ts` with `SPEC-342` (honest structural-heuristic framing, content-deterministic SHA-256 signature without wall-clock `Date`, and `resolveEvidencePath` hermeticity). Refresh `supply-chain:bind` and verify full `verify:strict`.
  - Checks: `node --test test/eosTreeSitterWasmEngine.test.mjs test/eosCliCatalogHygieneGovernor.test.mjs test/eosMcpTier0TokenEconomy.test.mjs test/glorianCliBinary.test.mjs`, `npm run verify:strict`.

## Tasks

- [x] **T1** (`S1`) | Route: `inline` | Risk: `High (item 2: import-boundary security guard; item 3: shared AST lexer)` | Status: `done` | Evidence: RED (`eosSemanticGraph.test.mjs` ghost exports) -> GREEN (`coverage-ratchet` 100%/100% `eosTypeScriptAstAnalyzer.ts`, 98.76%/93.44% `eosArchitectureGuard.ts`, 96.78%/89.11% `eosSemanticGraph.ts`, `boundary:check` 636/636 PASS, `consumers:audit` 636/636 PASS, `typecheck` PASS)
- [ ] **T2** (`S2`) | Route: `inline` (sequential ordered pipeline; shares `eosContainerSandbox` surface with T3) | Status: `in_progress` | Evidence: pending RED/GREEN
- [ ] **T3** (`S3`) | Route: `inline` (sequential ordered pipeline; builds on T2 sandbox changes) | Status: `pending` | Evidence: pending
- [ ] **T4** (`S4`) | Route: `inline` (sequential ordered pipeline; finalizes CLI/MCP/SPEC-342 + supply-chain seal) | Status: `pending` | Evidence: pending

## Log

- **L1 (2026-11-23)**: User request verbatim: `"si vamos en orden como harian los mejores la landing no la toque nunca mas solo el motor de glorian solo eso vamos como harian los mas grandes"`
- **L2 (2026-11-23)**: Read-only explorer (`odd-explorer`) mapped repo gates: `<= 788` lines per `.ts`/`.mjs` (`SPEC-250`), `636/636` Layer-0 consumer moratorium (`SPEC-270`), freeze-pin lag `<= 2` commits, MCP `core` = `46` / `essential` = `18` locked invariants, and zero landing touches. Proceeding with T1..T4 in order on `feat/glorian-engine-bigtech-hardening`.
- **L3 (2026-11-23)**: Completed T1 (`S1`). Unified static import/re-export/dynamic/require and symbol extraction onto `extractModuleSyntax` in `eosTypeScriptAstAnalyzer.ts` across `eosArchitectureGuard.ts`, `eosSemanticGraph.ts`, `import-boundary-gate.mjs`, and `verify-module-consumers.mjs`.
