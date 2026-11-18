# CHANGE-202: Sovereign Closed-Loop Repository Autopilot Engine

## 1. Intent & Scope

While Glorian System possesses standalone frontier engines for bitemporal knowledge graphs (`SPEC-333`), discrete-event simulation (`SPEC-334`), causal structural models (`SPEC-338`), and agentic harness telemetry (`SPEC-339`), operating them only as isolated benchmarks limits closed-loop observability across live repository state.

`CHANGE-202` (`SPEC-340`) introduces `EosClosedLoopRepoAutopilotCore`, uniting those four engines vertically over live repository artifacts (`docs/projects/registry.json`, `docs/quality/mutation-budget.json`, `docs/evidence/TLC_RECEIPT.json`, and recent Git commits):

1. **Stage 1 (`ingestRepositoryOntology`)**: Loads live fleet projects, mutation-governed modules, and TLC-verified models into `EosOntologicalHypergraphCore` and synthesizes cross-artifact hyperedges.
2. **Stage 2 (`diagnoseCausalRootCause`)**: Builds an acyclic repository quality DAG via `EosCausalStructuralModelCore`, verifies $d$-separation and backdoor validity, and quantifies the interventional $\text{do}(\text{SPEC\_CLARITY})$ effect on PR First-Pass Yield alongside unit counterfactuals.
3. **Stage 3 (`simulateRemediationPreFlight`)**: Drives `EosDiscreteEventSimulationHypervisorCore` with Chandy-Lamport checkpointing, controlled transient fault injection, deterministic time-travel rollback, and invariant-checked replay.
4. **Stage 4 (`evaluateLiveGitHarnessTelemetry`)**: Converts recent repository commits (`git log -n 20 --oneline`, or deterministic offline fallback) into cohort records for `EosAgenticHarnessYieldCore` and validates a full 5-stage harness loop.
5. **TLA+ Model 84** (`ClosedLoopRepoAutopilot`) verified with Leslie Lamport's TLC.

## 2. Impacted Components

- `src/core/eosClosedLoopRepoAutopilot.types.ts`: domain types, stage contracts & error codes.
- `src/core/eosClosedLoopRepoAutopilot.ts`: closed-loop orchestration core composing `SPEC-333`, `SPEC-334`, `SPEC-338`, `SPEC-339`.
- `src/core/index.ts`: public export (`<= 788` lines per `SPEC-250`).
- `bin/commands/cliClosedLoopRepoAutopilot.mjs`, `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `src/core/eosMcpToolTaxonomy.ts`, `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`, `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- `docs/formal/ClosedLoopRepoAutopilot.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosClosedLoopRepoAutopilot.test.mjs` (`BDD-1815`..`BDD-1820`) & `scripts/mutation-gate.mjs` / `docs/quality/mutation-budget.json`.

## 3. Risk Assessment

- **Risk 1**: Missing or unreadable optional evidence files or unavailable `git` binary in air-gapped sandboxes.
  - _Mitigation_: Bounded fail-closed input validation for malformed project roots, paired with deterministic baseline fallback counts when optional Git CLI invocation is absent.
- **Risk 2**: Out-of-order execution promoting a repository change without passing simulation and harness stages.
  - _Mitigation_: Explicit TLA+ state machine invariants (`CausalDiagnosisRequiresIngestion`, `SimulationRequiresDiagnosis`, `VerificationRequiresCheckpoint`, `ZeroUnverifiedPromotion`) and runtime gate assertions.
