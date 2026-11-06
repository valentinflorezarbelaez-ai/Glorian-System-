# Frontiers 16–20 Evidence Matrix (Tip-Seal Scope)

**Date**: 2026-11-04  
**Codex**: `docs/governance/GLORIAN_20_FRONTIERS_CODEX.md`  
**Epistemic state**: `PRODUCTION_READY_WITHIN_TESTED_SCOPE`

| Frontier | Engine | Spec / Change | Verification | Status |
|---|---|---|---|---|
| 16 Hermetic SLSA / SBOM | `src/core/eosSlsaProvenanceSbom.ts` | SPEC-061 / SPEC-139 | `scripts/verify-supply-chain.mjs` exit 0; SBOM SHA-256 `32b53897…`; provenance SHA-256 `794271c9…` | EVIDENCED |
| 17 Kernel telemetry / eBPF profile | `src/core/eosEbpfKernelProbeEngine.ts`, `eosLinuxKernelCore.ts` | prior sealed CHANGEs | Present in Layer-0 inventory; bounded unit coverage via verify:strict Stage 4 | PRESENT_WITHIN_TESTED_SCOPE |
| 18 WCET / gas budgets | `eosEventLoopSaturationGovernor.ts`, `eosTokenBucketRateLimiter.ts` | prior sealed CHANGEs | Covered by verify:strict suite discovery | PRESENT_WITHIN_TESTED_SCOPE |
| 19 Nocturnal evolution | `eosNocturnalEvolutionEngine.ts` | SPEC-133 | `eos_nocturnal_evolution` receipt `c80f4ae6…` (audit-only) | EVIDENCED_AUDIT |
| 20 BFT / TMR | `eosBftAgentSwarmSlashing.ts`, `eos_tmr_consensus` | SPEC-065 | TMR invoked at tip-seal; BFT engine in L0 inventory | EVIDENCED |

## Tip ritual

1. tip-open: maturity program authorized (Level 3 control plane already in `IMPLEMENTATION_AUTHORIZATION.md`)
2. tip-refresh: freeze + release matrix inventory aligned (P2)
3. tip-seal: this matrix + `docs/evidence/EVD-MATURITY-P0-P1.json` + `docs/evidence/EVD-MATURITY-P2-P5.json`

No LADDER-14 opened. CHANGE-080 / SPEC-145 remains `PROPOSED` only.
