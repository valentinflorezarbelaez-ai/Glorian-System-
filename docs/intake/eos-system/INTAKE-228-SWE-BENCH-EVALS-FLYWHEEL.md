# INTAKE-228: SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel (Deterministic pass@k Benchmarking & Historical Git PR Synthetic Challenge Mining)

**Document ID**: `INTAKE-228-SWE-BENCH-EVALS-FLYWHEEL`  
**Target Specification**: `SPEC-366` / `CHANGE-228`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Lifecycle Tier**: `production`  
**Target Delivery Date**: 2026-11-19  
**Status**: `INTAKE_COMPLETE`  
**Level Authorization Required**: `LEVEL_3_PRODUCTION_AUTHORIZED`

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Need for Rigorous Quantitative Agent Evals in Agentic Engineering

Modern agentic engineering architectures (such as LIDR's Agentic Engineer curriculum, Cognition/Devin, SWE-bench Verified, and OpenAI Eval standards) demonstrate that LLM coding agents cannot be improved through unmeasured subjective prompt tweaking ("vibe coding"). Without reproducible benchmark testbeds:

1. **Unquantified Model Capability**: Developers cannot ascertain whether prompting adjustments, context compression, or model routing actually improve software resolution rates or degrade critical edge cases.
2. **Lack of Synthetic In-House Evals**: Public benchmarks (e.g. standard SWE-bench) suffer from data contamination and do not reflect internal monorepo conventions, architectural invariants, or specific domain rules across our 9 registered fleet repositories.
3. **Execution Safety & Cost Unpredictability**: Autonomous evaluation agents running in uncontrolled environments can mutate production branches, loop infinitely, or consume unbounded API tokens without strict timeout, memory, and cost bounds.

Glorian System requires `EosSweBenchEvalFlywheel`:

- A pure Layer-0 hermetic evaluation testbed implementing deterministic `pass@1`, `pass@k`, and `cost-per-resolution` scoring.
- Synthetic Eval Challenge Miner: parses Git history across the 9 fleet repositories (`aberamentho`, `atp-strength`, `biblioteca-gnostica-1`, `control-de-asistencia-abopack`, `crud-slack`, `donaciones`, `eos-system`, `performance-talent-group`, `portafolio`), turning real past bugfix PRs into isolated, executable benchmark challenges.
- Double-blind grading oracle combining ground-truth test execution with Triple-Modular Redundancy (TMR) consensus.
- Invariant-bound execution sandboxes with nanosecond CPU/memory profiling and emergency circuit breakers.

---

## 2. Strategic Objectives & Architectural Requirements

1. **Pure Layer-0 Evaluation Engine**:
   Zero runtime npm dependencies using native `node:crypto`, `node:fs`, `node:path`, and `node:child_process`.
2. **SWE-Bench Compatible Benchmark Protocol**:
   Implements problem statements, pre-patch workspace staging, golden test validation, and post-patch diff verification.
3. **Synthetic Git PR Challenge Mining**:
   Automatically mines git commits and pull request diffs across registered fleet repositories to generate reproducible, hermetic test problems.
4. **Statistical pass@k & Cost-Efficiency Matrix**:
   Calculates unbiased `pass@k` estimators ($k \in \{1, 3, 5\}$), mean token expenditure, execution latency, and patch minimality.
5. **Cryptographic Evaluation Receipt**:
   Every eval run emits an immutable SHA-256 signed receipt (`SWE_BENCH_EVAL_FLYWHEEL_RECEIPT.json`) validating SPEC-366 conformance.
6. **Leslie Lamport Formal Verification**:
   TLA+ Model 109 (`docs/formal/SweBenchEvalFlywheel.tla` / `.cfg`) modeling task dispatch, sandbox isolation, grading consensus, and scorecard monotonicity.
