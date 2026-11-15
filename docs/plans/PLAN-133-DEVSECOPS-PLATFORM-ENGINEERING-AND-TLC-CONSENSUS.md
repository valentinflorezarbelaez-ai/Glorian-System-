# PLAN-133 — DevSecOps Platform Engineering, Core De-Insularization, and Distributed TLC Consensus

## Metadata

- **Plan ID**: PLAN-133
- **Change Reference**: [CHANGE-133-devsecops-platform-engineering-and-tlc-consensus.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/changes/CHANGE-133-devsecops-platform-engineering-and-tlc-consensus.md)
- **Spec Reference**: [SPEC-271-DEVSECOPS-PLATFORM-ENGINEERING-AND-TLC-CONSENSUS.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/specs/SPEC-271-DEVSECOPS-PLATFORM-ENGINEERING-AND-TLC-CONSENSUS.md)
- **Status**: APPROVED

---

## 1. Architectural Decisions (ADRs)

### ADR-133-001: In-Process Kernel Shielding (Rate Limiting, Idempotency & Backpressure)

- **Context**: Vercel Hobby plan hard-limits serverless functions to 12. External proxies or middleware functions are not permitted under the quota budget. Layer-0 modules exist in `src/core/` but were unconsumed by the HTTP layer.
- **Decision**: Wire `EosAdaptiveRateLimiter`, `EosEventLoopSaturationGovernor`, and `EosIdempotencyKeyStore` directly into `api/kernel.js` and `api/health.js` as in-process interceptors.
- **Consequences**:
  - Positive: Zero additional serverless functions; functions stay at 12/12. Protection against request storms, replay charges, and CPU saturation is enforced natively. Unconsumed module count drops significantly.
  - Negative: `api/kernel.js` imports additional core modules.

### ADR-133-002: Dual-Standard Supply Chain Attestation (SPDX + CycloneDX v1.5)

- **Context**: Government and financial standards (EO 14028, NIST SP 800-218, PCI-DSS 4.0) increasingly mandate CycloneDX alongside SPDX for software supply chain transparency.
- **Decision**: Update `scripts/sbom-gate.mjs` to invoke `EosCycloneDxSbomGenerator` generating `docs/evidence/cyclonedx-sbom.json` alongside the existing SPDX SBOM.
- **Consequences**: Full compliance with both US/EU enterprise supply chain standards with zero external npm dependencies.

### ADR-133-003: Distributed Protocol TLC Configurations (Raft & CRDT)

- **Context**: `RaftConsensusEngine.tla` and `CrdtStateSyncCore.tla` were verified only through bounded JS simulation. Formal model exploration requires `.cfg` definitions.
- **Decision**: Author `RaftConsensusEngine.cfg` and `CrdtStateSyncCore.cfg`, ensuring TLA+ modules declare necessary extensions (`FiniteSets`, `Sequences`, `TLC`) and are checked by `scripts/run-tlc.mjs`.
- **Consequences**: Mathematically proves safety and convergence of Glorian's distributed state synchronization.

### ADR-133-004: Incremental PTS-Driven Code Coverage Ratchet

- **Context**: Running full V8 coverage across 262 test suites takes ~5 minutes, making whole-suite coverage infeasible on every local commit. Skipping it entirely creates a blind spot.
- **Decision**: Author `scripts/coverage-ratchet.mjs` which reads the commit diff, determines impacted source files via PTS, executes coverage only on those files, and compares against `docs/quality/coverage-budget.json`.
- **Consequences**: Provides sub-second coverage verification on pre-commit and pre-push while strictly preventing coverage regression.
