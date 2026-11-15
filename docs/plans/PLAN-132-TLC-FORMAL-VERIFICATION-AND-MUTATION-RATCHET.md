# PLAN-132 — TLC Formal Verification Engine, Mutation Ratchet Expansion, and Consumer Governance

## Metadata

- **Plan ID**: PLAN-132
- **Change Reference**: [CHANGE-132-tlc-formal-verification-and-mutation-ratchet.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/changes/CHANGE-132-tlc-formal-verification-and-mutation-ratchet.md)
- **Spec Reference**: [SPEC-270-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/specs/SPEC-270-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md)
- **Status**: APPROVED

---

## 1. Architectural Decisions (ADRs)

### ADR-132-001: Declarative `.cfg` TLC Configurations with Adaptive Local/CI Runner

- **Context**: TLA+ specifications previously existed only as syntax validated by a custom JS regex/simulation script (`scripts/verify-formal-tla.mjs`). TLC model checker was not run, leaving safety invariants unverified across complete state spaces.
- **Decision**:
  1. Author standard TLC `.cfg` files for core protocols (`LmaxDisruptor`, `HermesConsensusMesh`, `DatomicBitemporalLedger`, `AutonomousChaosDisruptor`).
  2. Implement `scripts/run-tlc.mjs` which checks for `java` and `tla2tools.jar`. If available, it invokes TLC to verify state spaces and parse generated distinct states / distinct transitions into `docs/evidence/TLC_RECEIPT.json`.
  3. If Java is not installed locally (e.g., developer machine running strictly Node/Go), `scripts/run-tlc.mjs` validates the structural integrity and parse readiness of `.tla` + `.cfg` pairs and records `DEFERRED_TO_CI_SETUP_JAVA` in the receipt.
  4. In CI (`.github/workflows/eos-nightly-deep-gates.yml`), install Java 21 via `actions/setup-java@v4`, download/cache `tla2tools.jar`, and execute TLC as an automated blocking gate.
- **Consequences**: Brings formal mathematical proofs to the core distributed protocols without breaking developer machines that lack a local Java runtime.

### ADR-132-002: Flexible Target-to-Test Mapping in Mutation Testing Engine

- **Context**: `scripts/mutation-gate.mjs` had hardcoded assumptions that target files must reside in `src/core/<Name>.ts` and have tests in `test/<Name>.test.mjs`. This prevented testing governance scripts (like `scripts/verify-vercel-function-budget.mjs`) or modules whose tests are structured differently.
- **Decision**: Introduce a `CUSTOM_TARGET_TEST_MAP` dictionary in `scripts/mutation-gate.mjs` that allows mapping any file to one or more specific test files. Expand `DEFAULT_TARGETS` and `docs/quality/mutation-budget.json` to include governance modules and scripts.
- **Consequences**: Significantly increases mutation test coverage across the governance plane and catches silent regressions in test suite assertions.

### ADR-132-003: Architectural Moratorium and Consumer Graph Auditing

- **Context**: Multiple Layer-0 domain specifications (e.g. `SPEC-259`..`SPEC-268`) were authored without active consumers in the fleet or governance core beyond self-referential CLI tests.
- **Decision**: Author `scripts/verify-module-consumers.mjs` to trace and score internal module consumption across `src/core/`, `api/`, and `bin/`. Institute a formal moratorium: no new Layer-0 specifications may be created without an explicit production or fleet consumer declaration.
- **Consequences**: Halts spec bloat and directs engineering focus towards hardening, integration, and adoption of existing core systems.
