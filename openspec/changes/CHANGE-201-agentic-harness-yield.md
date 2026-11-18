# CHANGE-201: Agentic Harness Engineering, First-Pass PR Yield & Token Rework Telemetry Engine

## 1. Intent & Scope

Unconstrained LLM-assisted coding ("vibe coding") without formal specifications or deterministic validation harnesses yields high token burn, multi-round rework loops, and unpredictable Pull Requests (PRs) that burden human reviewers.

`CHANGE-201` (`SPEC-339`) introduces `EosAgenticHarnessYieldCore`, operationalizing the three pillars of the **Agentic Engineer 2027 (LIDR)** paradigm inside Glorian System's Layer-0 Core:

1. **Spec-Driven Readiness Gate**: Quantifies EARS, BDD, ADR, TLA+ completeness, and ambiguity bounds prior to implementation, blocking underspecified tasks (`HARNESS_SPEC_INCOMPLETE`).
2. **Bounded Multi-Stage Harness Loop**: Runs an ordered validation pipeline (`TYPECHECK` $\to$ `LINT_FORMAT` $\to$ `UNIT_BDD` $\to$ `FORMAL_TLC` $\to$ `SECURITY_HYGIENE`) with deterministic stage-attributed rework accounting and a circuit breaker (`HARNESS_MAX_RETRIES_EXCEEDED`).
3. **FinOps PR Yield & Cohort Telemetry**: Computes First-Pass PR Yield (FPY), Rework Amplification Factor ($\text{RAF}$), USD cost per verified PR, and SDD-vs-Vibe cohort token savings.
4. **TLA+ Model 83** (`AgenticHarnessYield`) verified with Leslie Lamport's TLC.

## 2. Impacted Components

- `src/core/eosAgenticHarnessYield.types.ts`: domain contracts & error codes.
- `src/core/eosAgenticHarnessYield.ts`: core readiness, harness loop, cohort FinOps & audit engine.
- `src/core/eosStreamingLlmAttentionSinks.ts` & `src/core/index.ts`: export consolidation keeping `src/core/index.ts` $\le 778$ lines (`SPEC-250`).
- `bin/commands/cliAgenticHarnessYield.mjs`: CLI subdispatcher (`toolchain:harness:`).
- `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`.
- `docs/formal/AgenticHarnessYield.tla` & `.cfg`, `scripts/run-tlc.mjs`.
- `test/eosAgenticHarnessYield.test.mjs` (`BDD-1809`..`BDD-1814`).

## 3. Risk Assessment

- **Risk 1**: Autonomous agent self-repair loops spiraling into unbounded token consumption on unsolvable stage failures.
  - _Mitigation_: Strict retry budget enforcement (`HARNESS_MAX_RETRIES_EXCEEDED`) terminates runaway loops fail-closed.
- **Risk 2**: Underspecified or ambiguous prompts slipping into code generation and inflating downstream PR rework.
  - _Mitigation_: Mandatory pre-flight `assertSpecReadiness` gate blocks execution when readiness score $< 80$, ambiguity $> 0.15$, or required artifacts (EARS/BDD/ADR) are missing.
