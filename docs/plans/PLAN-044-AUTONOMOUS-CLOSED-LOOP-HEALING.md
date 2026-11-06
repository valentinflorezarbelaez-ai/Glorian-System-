# PLAN-044 & ADR-057 — AUTONOMOUS CLOSED-LOOP SURGICAL SELF-HEALING ARCHITECTURE
**Status**: ACCEPTED  
**Date**: 2026-10-30  
**Context**: SPEC-051, CHANGE-044, EOS v57.0.0  

---

## Architecture Decision Record (ADR-057)

### Context
When code breaks in production or during autonomous CI/CD loops, agents frequently overwrite entire files, destroying carefully constructed comments, types, and unrelated logic. We need an automated self-healing mechanism that strictly isolates the fault and applies minimal surgical patches.

### Decision
1. **NASA FDIR Diagnostics**:
   - Parse error messages, stack frames, and AST nodes into a structured `FaultDiagnostic`: `{ filePath, lineNumber, faultySymbol, errorType, rawMessage }`.
2. **Surgical Patch Synthesis (Meta SapFix Pattern)**:
   - Generate localized patches (null-check guard, boundary check, try/catch recovery, or invariant assertion) affecting only the target line range.
3. **Closed-Loop In-Memory Sandbox**:
   - Execute the patched source in an isolated environment against the failing test or evaluator.
   - If the patch passes the target test: verify against the regression harness.
   - If regressions are detected: discard immediately and flag `REGRESSION_REJECTED`.
4. **Attestation & Durable Recording**:
   - Persist failure diagnostic, candidate patch diff, and verification receipts in `EosDurableSqliteLedger`.

### Consequences
- True autonomous self-healing without hallucinating collateral code changes.
- Safe automated repair of high-frequency runtime bugs (null dereference, off-by-one, boundary overflows).
- Zero external runtime npm dependencies.
