# PLAN-228: Architectural Plan for SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel

**Document ID**: `PLAN-228-SWE-BENCH-EVALS-FLYWHEEL`  
**Specification Target**: `SPEC-366` / `CHANGE-228`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Philosophy & Evaluation Flywheel

`EosSweBenchEvalFlywheel` implements the continuous evaluation loop for autonomous software engineering agents:

1. **Hermetic Task Isolation**: Executes tests within dedicated in-memory file systems or ephemeral Git worktrees, isolating agent mutations from the developer workspace.
2. **Double-Blind Oracle Verification**: The test oracle (`fail_to_pass` tests) is evaluated in two phases:
   - Phase 1 (_Baseline verification_): Confirms tests fail before the patch is applied.
   - Phase 2 (_Resolution verification_): Confirms tests pass after the candidate patch is applied.
3. **Synthetic Challenge Mining**: Mines commit diffs and closed PRs from our 9 registered fleet repositories, transforming internal software maintenance into private benchmark challenges immune to LLM pre-training contamination.
4. **pass@k Statistical Estimator**: Implements standard HumanEval / SWE-bench unbiased pass@k estimation:
   $$\text{pass@}k = 1 - \frac{\binom{n - c}{k}}{\binom{n}{k}}$$
   where $n$ is total candidate samples and $c$ is successful resolutions.

---

## 2. Architecture Decision Record (ADR-228-001)

### Title

**ADR-228-001: In-Process Hermetic Workspace Overlay vs Heavy Docker Containers for Fleet Evals**

### Status

`ACCEPTED`

### Context

Standard SWE-bench implementations require full Docker container virtualization for every challenge, which takes 2-5 minutes per image build, consumes tens of gigabytes of disk space, and requires privileged Docker daemon access. In Glorian System, Layer-0 purity mandates zero mandatory third-party runtime dependencies.

### Decision

Implement `EosSweBenchEvalFlywheel` using native Node.js isolated workspace overlays, in-memory Git patch application, and child process execution sandboxes with strict CPU, memory, and timeout bounds. Docker is supported as an optional auxiliary backend, but the Layer-0 in-memory sandbox operates natively on any host without container runtimes.

### Consequences

- **Positive**: 100x faster startup (< 100ms vs 2 minutes); zero Docker dependency required for nominal runs; fully compatible with Windows, Linux, and macOS; mathematically reproducible.
- **Negative**: Cannot evaluate kernel-level or binary system-level driver changes requiring dedicated OS virtualization.

---

## 3. Rejected Alternatives

- **External SWE-Bench Python CLI via Conda**: Rejected due to adding Python, pip, and Conda runtime dependencies into a pure Node.js Layer-0 control plane.
- **Unverified Patch Mocking**: Rejected because mocking test execution produces ungrounded claims, violating the Law of Evidence Over Claims.
