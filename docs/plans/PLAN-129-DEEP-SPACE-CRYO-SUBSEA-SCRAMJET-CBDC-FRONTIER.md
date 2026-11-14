# PLAN-129 — Architecture Plan & ADRs (`CHANGE-129` / `SPEC-259`..`SPEC-263`)

## Metadata

- **Plan ID**: PLAN-129
- **Change Ref**: CHANGE-129
- **Target SPECs**: SPEC-259, SPEC-260, SPEC-261, SPEC-262, SPEC-263
- **Date**: 2026-11-14
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Modules 79–83 (`EosDeepSpaceOpticalNavEphemerisCore`, `EosCryogenicJosephsonSfqControlCore`, `EosSubseaCoherentDwdmNonlinearShannonCore`, `EosHypersonicAerothermodynamicsScramjetCore`, `EosCbdcRtgsGridlockResolutionCore`) reside strictly in Layer-0 `src/core/`, importing only `./eosKernelPrimitives.ts` (`deepFreeze`, `pureSha256`), `./eosNumericContractGuards.ts`, and their paired `.types.ts` contracts so every function stays within cyclomatic complexity `<= 8` (`<= 15` gate).

---

## 2. Architectural Decision Records (ADRs)

### ADR-129-001 — Zero-`any` Strict Type Narrowing in Phase-7 Frontier Handlers

- **Decision**: Replace `Record<string, any>`, `(c: any) => ...`, and `format as any` across `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts` and `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` with `Record<string, unknown>` and explicit runtime-validated union/readonly casts.
- **Rejected Alternative**: Leaving `Record<string, any>` inside MCP Phase-7 extension handlers where malformed JSON-RPC payloads could mask static type errors.

### ADR-129-002 — Top-5 Module Decompression (`<= 745` Lines, `minHeadroomLines >= 55`)

- **Decision**: Compact multi-line literal payloads and verbose comments in `scripts/verify-cicd-pipeline.mjs`, `src/core/eosContainerSandbox.ts`, `src/core/eosAntigravityDirector.ts`, `bin/commands/cliFrontierMesh.mjs`, and `src/core/eosSpotifyCodex.ts` so every module across `src/`, `scripts/`, and `bin/` maintains `>= 55` lines of headroom below the `800`-line ceiling without breaking `npm run contract:live`.
- **Rejected Alternative**: Raising `defaultMaxLines` above `800` or adding per-file exceptions in `docs/quality/size-budget.json`.

### ADR-129-003 — Formal TLA+ Verification Expansion (`45 -> 50` Models, `10,200` Steps)

- **Decision**: Author `HighNaEuvLithoOpc.tla`, `DifferentialPrivacyAbac.tla`, `LobAlmgrenChrissVpin.tla`, `UnifiedMemoryDvfsQos.tla`, and `RelativisticBeamTwiss.tla` under `docs/formal/` alongside 5 `200`-step state-space verifiers in `scripts/tla/tlaSimulationsPart4.mjs` wired into `scripts/verify-formal-tla.mjs`.
- **Rejected Alternative**: Stopping formal model-checking at `45` models and leaving the most recent computational physics and market-microstructure state machines without temporal invariants.

### ADR-129-004 — Modular Layer-0 Deep-Tech Engines & Thin CLI/MCP Delegation (`Ext4` + `cliDeepTech259To263`)

- **Decision**: Add dedicated thin adapters `src/mcp/tools/eosMcpPhase7FrontierExt4.ts` and `bin/commands/cliDeepTech259To263FrontierMesh.mjs` chained cleanly from `eosMcpPhase7FrontierExt3.ts`, `cliContiguous253FrontierMesh.mjs`, and `cliJarvisPolyglotFrontierMesh.mjs` to keep every file `<= 350` lines while reaching `167` MCP actions (`ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS`) and `357/357` CLI parity.
- **Rejected Alternative**: Appending more inline handlers directly into `cliJarvisPolyglotFrontierMesh.mjs` and risking line-budget pressure.
