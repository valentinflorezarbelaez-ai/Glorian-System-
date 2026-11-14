# INTAKE-123 — Live Git Contract Evolution, In-Toto/SLSA Ed25519 Attestor & Golden SWE Benchmark Harness

## Metadata

- **Intake ID**: INTAKE-123
- **Change Ref**: CHANGE-123
- **Target SPECs**: SPEC-244, SPEC-245, SPEC-246
- **Date**: 2026-11-13
- **Requester**: Valentín Flórez Arbeláez (System Owner — directive `"si dale con todo"`)
- **Status**: INTAKE_COMPLETE

---

## 1. Context & Problem Statement

To close the three elite Big Tech engineering critiques on **Glorian System (`v75.0.0`)**:

1. **Live Git Contract Evolution (`SPEC-244`)**: Connect `EosApiContractSemanticDiffCore` directly to live Git history (`git diff --name-only <baseRef>` + `git show <baseRef>:<path>` vs current disk source) across modified TypeScript modules under `src/` so breaking public API changes in real edits are automatically surfaced during `glorian ship`.
2. **In-Toto Statement v1 + SLSA v1.0 DSSE Ed25519 Attestor (`SPEC-245`)**: Issue and verify cryptographically signed DSSE (`application/vnd.in-toto+json`) envelopes containing In-Toto Statement v1 / SLSA Provenance v1.0 predicates signed with native Node `Ed25519` keys over the real SHA-256 digests produced by `glorian ship`.
3. **Golden SWE Benchmark Harness (`SPEC-246`)**: Provide a deterministic evaluation corpus exercising real adversarial and clean scenarios across Glorian engines (live diff, credential & DDL checks, semantic contract diff, shrinking PBT, and Law IV fleet readiness) and computing exact Precision, Recall, F1-Score, False Positive Rate, and Accuracy.

---

## 2. Constraints

- **Zero Runtime Dependencies (Law V)**: All Layer-0 engines in `src/core/` MUST import only `node:*` built-ins and sibling `./*.ts` modules.
- **Complexity & File Size Budget**: Every function MUST keep cyclomatic complexity `<= 15`, and every `src/`, `bin/`, and `scripts/` file MUST remain `<= 800` lines.
- **Tier-0 MCP Budget**: Expose new actions under `eos_enterprise_workspace` without changing the `46` Tier-0 MCP tool schema count.
