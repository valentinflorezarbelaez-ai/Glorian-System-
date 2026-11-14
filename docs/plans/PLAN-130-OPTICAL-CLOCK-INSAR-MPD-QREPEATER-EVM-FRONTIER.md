# PLAN-130 — National Labs & Consortium Frontier (`SPEC-264`..`SPEC-268`), 55 TLA+ Models & Top-5 Decompression

## Metadata

- **Plan ID**: PLAN-130
- **Change ID**: CHANGE-130
- **Intake Reference**: [INTAKE-130-OPTICAL-CLOCK-INSAR-MPD-QREPEATER-EVM-FRONTIER.md](file:///c:/Users/valen/Documents/Glorian-System/docs/intake/eos-system/INTAKE-130-OPTICAL-CLOCK-INSAR-MPD-QREPEATER-EVM-FRONTIER.md)
- **Authorization**: `AUTH-2026-11-14-OPTICAL-CLOCK-INSAR-MPD-QREPEATER-EVM-FRONTIER` (`LEVEL 3`)
- **Date**: 2026-11-14

## 1. Architectural Decision Records (ADRs)

### `ADR-130-001` — Pure Layer-0 Physical & Formal Symbolic Invariants Without External Runtime Dependencies

- **Decision**: Implement Modules 84–88 (`SPEC-264`..`SPEC-268`) exclusively in `src/core/` using `eosKernelPrimitives.ts` and `eosNumericContractGuards.ts` with immutable `deepFreeze` outputs and SHA-256 digests.
- **Rejected Alternative**: Importing external symbolic execution, SAR/GIS, or multiphysics bindings into `package.json` (`dependencies`), which violates EOS Law V and breaks single-binary/offline portability.

### `ADR-130-002` — Formal TLA+ Model Parity for `SPEC-259`..`SPEC-263` (`50 -> 55` Models)

- **Decision**: Author five standalone `.tla` modules (`DeepSpaceOpticalNav.tla`, `CryogenicJosephsonSfq.tla`, `SubseaDwdmShannon.tla`, `HypersonicScramjetAero.tla`, `CbdcRtgsGridlock.tla`) using explicit `INVARIANT_NAME_KEYWORDS` and paired `200`-step deterministic simulation verifiers in `scripts/tla/tlaSimulationsPart4.mjs` (`11,200` total steps).
- **Rejected Alternative**: Leaving `SPEC-259`..`SPEC-263` unbacked by TLA+ models, creating a lag between code modules and formal verification proofs.

### `ADR-130-003` — Structural Decompression of Top-5 Largest Modules (`<= 738` Lines)

- **Decision**: Eliminate internal duplication (`isLockActive` helper in `eosGentlemanAutoUpdater.ts`, unified hex-prefix nibble packing in `eosMerklePatriciaTrieCore.ts`, consolidated `!leader` guard in `eosRaftConsensusEngine.ts`, `tryIgnore` helper in `eosSpotifyAgenticFactory.ts`, `fnv1a32` + `rankVectors` in `eosHybridKnowledgeEngine.ts`) to lift global `minHeadroomLines` from `46` to `>= 55` without changing public APIs.
- **Rejected Alternative**: Splitting files blindly across new wrapper modules, which would obscure cohesive single-module ownership without reducing internal code duplication.

### `ADR-130-004` — Exact `347/347` CLI Parity & Documentation Synchronization

- **Decision**: Wire all 5 new CLI commands (`clock:optical`, `insar:deform`, `mpd:thruster`, `qnet:repeater`, `evm:prove`) into `cliDeepTech259To263FrontierMesh.mjs`, `cliContiguous253FrontierMesh.mjs`, `cliJarvisPolyglotFrontierMesh.mjs`, and `cliHelpCatalog.mjs`, and reconcile the command parity count in Section `4.1` of `docs/DEVELOPER_GUIDE.md` from the stale `357` string to exact verified `347/347`.
- **Rejected Alternative**: Leaving documentation counts drifting above actual registered `HANDLERS[...]`, which undermines epistemic audit precision (EOS Law III).
