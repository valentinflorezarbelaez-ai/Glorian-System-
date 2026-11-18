# PLAN-201: Agentic Harness Engineering, First-Pass PR Yield & Token Rework Telemetry Engine

## 1. Architecture

```
 ┌────────────────────────────────────────────────────────────────────┐
 │               EosAgenticHarnessYieldCore (SPEC-339)                │
 │                                                                    │
 │  ┌──────────────────────────┐    ┌──────────────────────────────┐  │
 │  │ SDD Readiness Gate (FR-1)│    │ Multi-Stage Harness Loop     │  │
 │  │ • EARS, BDD, ADR, TLA+   │───►│ • TYPECHECK -> LINT_FORMAT   │  │
 │  │ • Ambiguity <= 0.15      │    │   -> UNIT_BDD -> FORMAL_TLC  │  │
 │  │ • Score >= 80 fail-closed│    │   -> SECURITY_HYGIENE        │  │
 │  └──────────────────────────┘    │ • Bounded retry budget       │  │
 │                                  └──────────────┬───────────────┘  │
 │                                                 │                  │
 │                                                 ▼                  │
 │  ┌──────────────────────────────────────────────────────────────┐  │
 │  │      FinOps Yield & Rework Telemetry Engine (FR-4, FR-5)     │  │
 │  │  • First-Pass PR Yield (FPY) & Rework Amplification (RAF)    │  │
 │  │  • Cost per Verified PR (USD) & SDD vs Vibe Savings Ratio    │  │
 │  └──────────────────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────────────────┘
```

## 2. Architecture Decision Records

### ADR-201-001: Fail-Closed SDD Readiness Gate Before Code Generation

- **Context**: Prompting autonomous coding agents with underspecified or ambiguous requests produces hallucinations, architectural drift, and expensive multi-turn PR rework.
- **Decision**: Compute an explicit readiness score (0..100) from verified specification primitives (`earsRequirements >= 1`, `bddScenarios >= 1`, `adrCount >= 1`, `hasFormalTlaModel`, and `ambiguityScore <= 0.15`) and block harness execution with `HARNESS_SPEC_INCOMPLETE` whenever the readiness threshold (`>= 80`) or ambiguity ceiling is violated.
- **Rejected Alternative**: Allowing best-effort code generation on informal prompts and catching defects only during late code review.

### ADR-201-002: Bounded Self-Repair Loop with Stage-Attributed Token Accounting

- **Context**: Harness engineering relies on automated compiler, linter, test, and formal verification loops so defective patches never reach human reviewers, yet unbounded retries cause runway token expenditure.
- **Decision**: Execute validation stages in strict deterministic dependency order, tracking `firstPassTokens` separately from repair `reworkTokens`, and enforce a hard `maxRetries` circuit breaker (`HARNESS_MAX_RETRIES_EXCEEDED`).
- **Rejected Alternative**: Unbounded agent retry loops without retry ceilings or stage-level token attribution.

### ADR-201-003: First-Pass PR Yield (FPY) & Rework Amplification Factor (RAF) Telemetry

- **Context**: Raw lines-of-code velocity hides wasted tokens spent fixing avoidable specification or quality errors across agent turns.
- **Decision**: Track First-Pass PR Yield ($\text{FPY} \in [0, 1]$), Rework Amplification Factor ($\text{RAF} = \text{totalTokens} / \text{firstPassTokens} \ge 1.0$), wasted rework tokens, and USD cost per verified PR as first-class FinOps engineering KPIs.
- **Rejected Alternative**: Measuring raw PR count or total token spend without separating first-pass value from rework waste.
