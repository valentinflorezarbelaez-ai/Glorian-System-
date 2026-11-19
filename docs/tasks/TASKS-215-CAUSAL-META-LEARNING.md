# TASKS-215: Autonomous Causal Meta-Learning & Counterfactual Policy Engine

- **Change ID**: `CHANGE-215`
- **Spec ID**: `SPEC-353`
- **Component**: `eos-system-control-plane`
- **Status**: `COMPLETED`
- **Date**: 2026-11-19
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## Atomic Implementation Task DAG

```
Task 1 (Types) ──> Task 2 (SCM & Do-Calculus) ──> Task 3 (Counterfactuals & Distiller) ──> Task 4 (TLA+ Model 96) ──> Task 5 (CLI & MCP) ──> Task 6 (Test Suite & Verification Gate)
```

- [x] **Task 1: Core Type Definitions (`src/core/eosCausalMetaLearning.types.ts`)**
  - Define `CausalNode`, `CausalEdge`, `StructuralEquation`, `StructuralCausalModel`, `Intervention`, `CounterfactualQuery`, `CausalAuditReceipt`.
  - Done Criteria: Clean compilation, 100% type-safe, 0 external imports.

- [x] **Task 2: SCM Graph Engine & Do-Calculus Graph Surgery (`src/core/eosCausalMetaLearning.ts` Part A)**
  - Implement DAG validation, cycle detection, topological sort, graph mutilation ($G_{\overline{X}}$), and Backdoor Criterion path blocking.
  - Done Criteria: Cycle detection rejects cyclic graphs with `CYCLIC_CAUSAL_DEPENDENCY_DETECTED`; graph surgery cleanly severs incoming edges.

- [x] **Task 3: Algorithmic Counterfactuals & Policy Meta-Distillation (`src/core/eosCausalMetaLearning.ts` Part B)**
  - Implement 3-step Abduction $\to$ Action $\to$ Prediction counterfactual evaluator and Average Treatment Effect (ATE) calculator.
  - Done Criteria: Counterfactual outputs are deterministic and match structural invariants.

- [x] **Task 4: Leslie Lamport TLA+ Model 96 (`docs/formal/CausalMetaLearning.tla` & `.cfg`)**
  - Model SCM acyclicity, interventional edge mutilation, and counterfactual determinism.
  - Done Criteria: Bounded simulation and model checker pass with 0 invariant violations.

- [x] **Task 5: CLI Command & MCP Tool Integration (`bin/commands/cliCausalMetaLearning.mjs`)**
  - Implement `toolchain:causal:audit`, `toolchain:causal:intervene`, `toolchain:causal:counterfactual`.
  - Wire into toolchain router, help catalog, and Phase 8 MCP server.
  - Done Criteria: Pure JSON output with exit code 0.

- [x] **Task 6: Automated Test Suite & Verification Gate (`test/eosCausalMetaLearning.test.mjs`)**
  - Implement tests verifying `BDD-1897` through `BDD-1902`.
  - Execute test runner, verify receipt `CAUSAL_META_LEARNING_RECEIPT.json`, and run pre-commit gate.
  - Done Criteria: 6/6 BDD tests pass, coverage $\ge 90\%$, 0 lint/format warnings.
