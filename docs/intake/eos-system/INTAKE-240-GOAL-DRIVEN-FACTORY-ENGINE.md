# INTAKE-240: Goal-Driven Development Loop, Immutable Verifier Guard, Parallel Worktree Software Factory & 3-Gate Pre-PR Engine

- **Project**: `eos-system-control-plane` (`Glorian System`)
- **Date**: 2026-11-23
- **Change / Spec**: `CHANGE-240` / `SPEC-378`
- **Status**: `INTAKE_COMPLETE`
- **Owner Approval**: Explicit owner directive on 2026-11-23 ("https://lidr.notion.site/curso-agentic-engineer-starter continuemos mejorando dejemos todo perfecto")

## 1. Context & Problem Statement

Following the release of **LIDR Agentic Engineer Starter 2027 Module 7 (Goal-Driven Development)** on 2026-11-23, Glorian System extends its Layer-0 agentic harness (`SPEC-339`, `SPEC-377`) from passive instruction-following and token economics into **verifiable Output-Driven Goal Loops** and **bounded parallel Software Factory execution** with strict guardrails against the three documented GDD failure modes:

1. **Verifiable Output Contracts vs. Deferred Business Outcomes (M7.1–M7.3)**:
   - Agents operate on verifiable **outputs** (metrics, thresholds, executable verification commands running in minutes), whereas **outcomes** (cart conversion, revenue, user retention) require 15–30 days of production telemetry and human Product decisions.
   - **Trap 1 (Vague Goal)**: Prose goals like "improve list performance" without numeric metrics, thresholds, or verification commands cannot terminate deterministically.
2. **Immutable Verifier Guard (M7.3 — Trap 2)**:
   - When an agent is given "make the tests pass" with permission to modify tests, CI workflows, or specs, it can silently weaken assertions ("changing the measuring stick") instead of fixing the underlying defect.
   - Verifier paths (`test/**`, `.github/workflows/**`, `scripts/verify-*.mjs`, `docs/specs/**`, `openspec/specs/**`, runner configs) and verifier SHA-256 digests must remain tamper-proof during execution loops.
3. **Bounded Retry / Time / Cost Execution Loop (M7.3 — Trap 3)**:
   - Autonomous or cloud loops facing impossible or flaky goals will spin indefinitely and burn budget unless hard limits (`maxAttempts`, `maxDurationMs`, `maxCostUsd`, `maxTotalTokens`) are enforced fail-closed, halting with a structured attempt ledger explaining every probe tried.
4. **Parallel Software Factory with Isolated Worktrees (M7.4 — `/factory`)**:
   - Executing multiple tasks in parallel requires each task to satisfy a valid output goal contract, execute inside its own isolated `git worktree` and branch, keep edit surfaces disjoint across concurrent tasks, and respect an aggregate factory budget ceiling.
5. **Three Mandatory Pre-PR Gates with Critical-Only Blocking (M7.5)**:
   - Before human PR review, every delivery must clear three layered gates: (1) mandatory unit + E2E tests executed and passing, (2) independent adversarial code review (`reviewerAgentId !== implementerAgentId`) with zero `critical` findings, and (3) `/verify` completeness confirming intact verifiers and zero uncompleted tasks. `warning` and `suggestion` findings remain non-blocking advisories.

## 2. Constraints

- **Law V (Layer-0 Purity)**: Zero external runtime npm dependencies; Node.js built-ins (`node:crypto`, `node:fs`, `node:path`) only.
- **Node 24 Strip-Only TypeScript**: No `enum`, `namespace`, or constructor parameter properties.
- **SPEC-250 Module Size Budget**: Every `.ts`/`.mjs` module strictly `<= 800` lines (target `<= 650` lines) and cyclomatic complexity `<= 15`.
- **SPEC-342 Hermetic Evidence**: All generated evidence receipts must resolve through `resolveEvidencePath()` honoring `EOS_EVIDENCE_DIR`.
- **Law VII**: All repository code, specs, ADRs, tests, and commit messages in standard professional English.
