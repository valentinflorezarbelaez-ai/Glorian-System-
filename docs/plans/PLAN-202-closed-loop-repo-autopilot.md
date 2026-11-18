# PLAN-202: Sovereign Closed-Loop Repository Autopilot Engine

## 1. Architecture

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                 EosClosedLoopRepoAutopilotCore (SPEC-340)                    │
 │                                                                              │
 │  [Live Repo: registry.json, mutation-budget.json, TLC_RECEIPT.json, git log] │
 │        │                                                                     │
 │        ▼ (1. Ontology: SPEC-333)                                             │
 │  ingestRepositoryOntology ──► Bitemporal Entities + Hyperedges + Audit       │
 │        │                                                                     │
 │        ▼ (2. Causal SCM: SPEC-338)                                           │
 │  diagnoseCausalRootCause  ──► DAG + Backdoor + do(SPEC_CLARITY) + Counterf.  │
 │        │                                                                     │
 │        ▼ (3. DESH Simulation: SPEC-334)                                      │
 │  simulateRemediationPreFlight ─► Checkpoint + Fault + Rollback + Replay      │
 │        │                                                                     │
 │        ▼ (4. Harness Yield: SPEC-339)                                        │
 │  evaluateLiveGitHarnessTelemetry ─► Live Git FPY/RAF + 5-Stage Harness Loop  │
 │        │                                                                     │
 │        ▼                                                                     │
 │  ClosedLoopAutopilotAuditReceipt (SHA-256 Digest)                            │
 └──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture Decision Records

### ADR-202-001: Vertical Composition Over Reimplementation of Frontier Engines

- **Context**: Glorian System already implements formally verified standalone engines for ontology (`SPEC-333`), DESH simulation (`SPEC-334`), causal SCM (`SPEC-338`), and agentic harness yield (`SPEC-339`).
- **Decision**: Instantiate and wire `EosOntologicalHypergraphCore`, `EosCausalStructuralModelCore`, `EosDiscreteEventSimulationHypervisorCore`, and `EosAgenticHarnessYieldCore` directly in a strict 4-stage pipeline instead of duplicating graph, causal, simulation, or FinOps math.
- **Rejected Alternative**: Writing a monolithic analyzer that reimplements DAG traversal, do-calculus, or event queues inline.

### ADR-202-002: Bounded Real-Repository Sampling with Deterministic Fallback

- **Context**: Reading hundreds of repository files unboundedly during unit tests or air-gapped sandboxes could slow execution or fail when `.git` CLI is absent.
- **Decision**: Sample bounded slices (up to `maxEntitiesPerSource`, default `12`) from real repository JSON artifacts (`registry.json`, `mutation-budget.json`, `TLC_RECEIPT.json`) and bounded `git log` commits (`commitLimit`, default `20`) using array-arg `spawnSync("git", ...)` without shell interpolation, falling back deterministically if `.git` is unavailable in an isolated fixture directory.
- **Rejected Alternative**: Executing arbitrary shell pipelines (`execSync`) or requiring live remote GitHub API network calls.

### ADR-202-003: Strict Stage Precondition State Machine (`ClosedLoopRepoAutopilot.tla`)

- **Context**: Promoting repository changes before causal diagnosis, checkpointed simulation replay, and harness readiness leads to unverified churn.
- **Decision**: Enforce stage progression (`IDLE -> INGESTED -> DIAGNOSED -> SIMULATED -> HARNESS_VERIFIED`) modeled and TLC-verified in TLA+ Model 84 (`ClosedLoopRepoAutopilot.tla`).
- **Rejected Alternative**: Permitting parallel unsequenced checks that report verification without checkpoint rollback safety.
