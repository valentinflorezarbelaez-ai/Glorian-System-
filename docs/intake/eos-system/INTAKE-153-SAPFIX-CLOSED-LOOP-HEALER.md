# INTAKE-153: Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine

- **Intake ID**: `INTAKE-153`
- **Change ID**: `CHANGE-153`
- **Spec Reference**: `SPEC-291`
- **Target Module**: `src/core/eosSapFixAutoRemediator.ts`
- **Tier**: Autonomous Self-Healing / AST Mutation Testing
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T20:45:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

Modern hyperscalers (notably Meta with SapFix and Google with automated repair systems) employ closed-loop autonomous repair pipelines that not only propose fixes, but also:

1. Synthesize candidate patches automatically from stack traces and test failures.
2. Validate patches against surviving mutants via AST mutation testing (ensuring the fix is not trivial or brittle).
3. Validate that test suites pass 100% and code coverage does not decrease.
4. Produce cryptographic approval hashes for human-in-the-loop audit before applying (`eos flow apply`).

Glorian System currently possesses static diagnostics (`eos heal`, `eos doctor`), but requires an end-to-end autonomous healing engine capable of mutating operators, synthesizing fixes, killing mutants, and issuing verifiable SHA-256 sealed patch receipts without third-party dependencies (Law V).

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero npm runtime packages.
- **AST Mutation Saboteur**: Generates arithmetic, relational, logical, and boolean operator mutations (`+` $\leftrightarrow$ `-`, `>` $\leftrightarrow$ `<=`, `&&` $\leftrightarrow$ `||`, `true` $\leftrightarrow$ `false`) to calculate mutation score $\frac{\text{Killed Mutants}}{\text{Total Mutants}}$.
- **Multi-Candidate Patch Synthesis**: Generates template-driven and AST-guided candidate replacements for failing lines or broken invariants.
- **Closed-Loop Verification**: Executes test validation on candidates, rejecting any candidate that fails unit tests, decreases line/branch coverage, or leaves critical mutants alive.
- **Cryptographic Approval Receipt**: Emits `docs/evidence/SAPFIX_HEAL_RECEIPT.json` sealed with SHA-256.
- **CLI Commands**: `toolchain:sapfix:mutate`, `toolchain:sapfix:heal`, `toolchain:sapfix:audit`.
