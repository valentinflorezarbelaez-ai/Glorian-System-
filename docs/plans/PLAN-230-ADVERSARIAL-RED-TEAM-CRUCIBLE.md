# PLAN-230: Architecture Plan & ADR for Adversarial Red-Team Crucible & Minimax Exploit-Patch Game

**Document ID**: `PLAN-230-ADVERSARIAL-RED-TEAM-CRUCIBLE`  
**Specification Target**: `SPEC-368` / `CHANGE-230`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Architectural Design & Topology

```
                  ┌──────────────────────────────────────────────┐
                  │      EosAdversarialRedTeamCrucible           │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
            Round Attack │                                │ Round Patch
                         ▼                                ▼
       ┌───────────────────────────────┐   ┌───────────────────────────────┐
       │   RedTeamAttackGenerator      │   │    BlueTeamPatchSynthesizer   │
       │ (Fuzzers, Invariant Violators,│   │ (CEGIS Guards, Sanitizers,    │
       │  Prompt Injections, Races)    │   │  Defensive Wrappers)          │
       └───────────────┬───────────────┘   └───────────────▲───────────────┘
                       │                                   │
                       ▼                                   │ Counterexamples
       ┌───────────────────────────────────────────────────┴───────────────┐
       │             Isolated Target Evaluation Harness                    │
       │  (Deterministic Execution, State Invariants, Exploit Classifier)   │
       └───────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │     MinimaxTournamentEngine   │
                       │ (Round Matrix, Nash Scorecard,│
                       │  Convergence Evaluator)       │
                       └───────────────────────────────┘
```

## 2. ADR-230-001: CEGIS-Driven Minimax Tournament for Agentic Defense

### Context

Autonomous agents are susceptible to unexpected inputs, hallucinated parameters, prompt exploits, and race conditions. Reactive debugging after deployment creates security vulnerabilities and operational outages. An automated, zero-sum game between attacker (Red-Team) and defender (Blue-Team) discovers vulnerabilities proactively prior to promotion.

### Decision

Implement a pure Layer-0 Minimax Tournament Engine based on Counterexample-Guided Inductive Synthesis (CEGIS):

1. **Red-Team**: Generates attack candidates categorized by taxonomy (`PROMPT_INJECTION`, `INVARIANT_VIOLATION`, `PATHOLOGICAL_PAYLOAD`, `RACE_CONDITION`).
2. **Evaluation**: Executes candidate in an isolated harness. If defensive invariant is violated, a structured counterexample is recorded.
3. **Blue-Team**: Synthesizes a defensive guard addressing the counterexample while running regression suites to prevent false positives.
4. **Convergence**: Tournament runs until defensive success rate $\ge 95\%$ or round budget is met.

### Consequences

- **Positive**: Proactive security and robustness hardening; zero manual pen-testing required for baseline threats; verifiable cryptographic receipts.
- **Negative / Trade-offs**: Computational cost scales with tournament round limit; bounded by the breadth of the mutation operators.

## 3. Rejected Alternatives

- **Third-Party Fuzzing Tools (e.g. AFL, libFuzzer)**: Rejected to preserve Layer-0 pure zero-dependency constraint.
- **LLM-Only Fuzzing**: Rejected due to non-deterministic behavior and external API dependencies; deterministic seedable fuzzer operators guarantee reproducible regression tests.
