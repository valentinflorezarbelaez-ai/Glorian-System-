# INTAKE-130 — National Labs & Consortium Frontier (`SPEC-264`..`SPEC-268`), Formal TLA+ (`55` Models), Top-5 Module Decompression & `347/347` CLI Parity

## Metadata

- **Intake ID**: INTAKE-130
- **Change ID**: CHANGE-130
- **Project**: `eos-system-control-plane` (`Glorian System`)
- **Requested By**: Principal Architect (`user:valentin-florez-arbelaez`)
- **Date**: 2026-11-14
- **Status**: `INTAKE_COMPLETE`
- **Authorization Target**: `LEVEL 3`

## 1. Context & Architectural Mandate

Following the Big-Tech, scientific-consortium, and national-laboratory evaluation audit against `CHANGE-129`, this intake formalizes five synchronized workstreams:

1. **Formal Verification Coverage (`50 -> 55` TLA+ Models / `11,200` Steps)**: Back `SPEC-259`..`SPEC-263` (`DeepSpaceOpticalNav`, `CryogenicJosephsonSfq`, `SubseaDwdmShannon`, `HypersonicScramjetAero`, `CbdcRtgsGridlock`) with bounded TLA+ specifications and `200`-step deterministic verifiers.
2. **Code Hygiene Headroom Lifting (`minHeadroomLines: 46 -> >= 55`)**: Decompress the current Top-5 largest modules (`eosGentlemanAutoUpdater.ts`, `eosMerklePatriciaTrieCore.ts`, `eosRaftConsensusEngine.ts`, `eosSpotifyAgenticFactory.ts`, `eosHybridKnowledgeEngine.ts`, `748`–`754` lines) to `<= 738` lines with zero behavioral regressions.
3. **Five National-Lab & Consortium Layer-0 Kernels (`SPEC-264`..`SPEC-268`, Modules 84–88, `0` external runtime dependencies)**:
   - `SPEC-264`: Optical Lattice Atomic Clock & Relativistic Geodesy Sync (`BIPM` / `NIST` / `PTB`)
   - `SPEC-265`: Interferometric SAR Crustal Deformation & Coherence Core (`ESA` / `NASA-JPL`)
   - `SPEC-266`: Magnetoplasmadynamic (MPD) Thruster & Lorentz Onset Stability (`NASA` / `JAXA` / `ESA`)
   - `SPEC-267`: Quantum Entanglement Repeater & BBPSSW Purification Protocol (`Fermilab` / `QuTech` / `CERN-QTI`)
   - `SPEC-268`: Smart-Contract Bytecode Gas & Symbolic CEI Reentrancy Verifier (`Ethereum` / `Formal Methods`)
4. **Full Control-Plane Parity (`172` MCP Actions / `347/347` Exact CLI Parity / Documentation Reconciliation)**: Wire all 5 modules into `eosMcpEnterpriseActionRegistry.ts` (`167 -> 172`), `eosMcpPhase7FrontierExt4.ts`, `src/core/index.ts`, `package.json`, `bin/commands/`, `cliHelpCatalog.mjs`, and reconcile Section `4.1` of `docs/DEVELOPER_GUIDE.md` to exact live parity (`347/347`).
5. **Adversarial & Boundary Branch Test Suite (`BDD-1366`..`BDD-1390` + Step `#57`)**: Verify every nominal, caution/warning, critical, precondition-failure, CLI `--json`, and MCP JSON-RPC `tools/call` path cleanly under `npm run test:ci`.
