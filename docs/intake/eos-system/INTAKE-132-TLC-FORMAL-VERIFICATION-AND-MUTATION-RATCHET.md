# INTAKE-132 — TLC Formal Verification Engine, Mutation Ratchet Expansion & Consumer Governance

## Metadata

- **Intake ID**: INTAKE-132
- **Project**: Glorian System (`eos-system-control-plane`)
- **Date**: 2026-11-14
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: INTAKE_COMPLETE
- **Priority**: P1 (Institutional Big-Tech Rigor & Formal Mathematical Grounding)

---

## 1. Context & Problem Statement

Following the successful restoration of live production and the deployment quota gate in `CHANGE-131`, this intake addresses the three core architectural findings identified in the Big-Tech / National Labs audit (`glorian_max_level_plan.md`):

1. **Formal Verification Honesty & TLC Execution**:
   - The repository maintains 55 TLA+ specifications in `docs/formal/`, but historically verified them only through custom bounded JavaScript sequential simulations (`11,200` steps).
   - Zero `.cfg` model configuration files existed. No formal state-space exploration or model checking with the Leslie Lamport TLC Model Checker (`tla2tools.jar`) was performed.
   - Requirement: Author declarative `.cfg` model configurations for core concurrent and distributed protocols (`LmaxDisruptor`, `HermesConsensusMesh`, `DatomicBitemporalLedger`, `AutonomousChaosDisruptor`), implement an automated runner `scripts/run-tlc.mjs` with distinct state extraction, wire Java 21 + pinned TLC jar execution into GitHub Actions CI, and enforce mandatory negative calibration (verifying TLC catches deliberate property violations).

2. **Mutation Testing Ratchet Expansion**:
   - The mutation testing gate (`scripts/mutation-gate.mjs`) previously governed only 15 of 359 modules (4%).
   - Critical governance engines—such as enterprise workspace governance, BFT consensus slashing, autonomous TLC execution, and the serverless quota budget—had no mutation test floors.
   - Requirement: Add custom target-to-test mapping in `scripts/mutation-gate.mjs`, expand `DEFAULT_TARGETS` and `docs/quality/mutation-budget.json` to include governance modules, and raise branch coverage baselines.

3. **Module Consumer Governance & Frontier Moratorium**:
   - Multiple Layer-0 domain specifications (`SPEC-259`..`SPEC-268`) were authored without active consumers in the fleet or governance core beyond their own CLI/MCP dispatchers.
   - Requirement: Author `scripts/verify-module-consumers.mjs` to map and audit module dependency graphs, and institute an architectural moratorium requiring every future Layer-0 module to declare an active fleet, product, or governance consumer.
