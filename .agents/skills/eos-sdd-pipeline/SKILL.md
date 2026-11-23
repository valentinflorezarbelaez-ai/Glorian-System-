---
name: eos-sdd-pipeline
description: Enforces the EOS 21-Step Specification-Driven Development (SDD) pipeline with IEEE 830 EARS requirements, Gherkin BDD scenarios, ADRs, TLA+ bounded simulations, and Level 2+ authorization gates. Use before implementing new features or architectural changes.
---

# EOS 21-Step Specification-Driven Development (SDD) Pipeline

Under **Law I (Zero Vibe Coding)** and **Law II (The Strict Gate)**, zero lines of production implementation code may be written until the complete specification package is formalized and authorized.

## 1. Strict Pre-Code Specification Package

Before creating or modifying production modules under `src/`, `api/`, or `bin/`:

1. **Amplify Requirements via MCP (`eos_amplify_prompt`)**
   Call `eos_amplify_prompt` on `eos-system`:
   ```json
   {
     "ServerName": "eos-system",
     "ToolName": "eos_amplify_prompt",
     "Arguments": {
       "rawPrompt": "<feature description>",
       "targetModel": "gemini",
       "strictLevel": "sovereign"
     }
   }
   ```
2. **Author the 6 Constitutional Artifacts**
   - **Intake**: `docs/intake/<project>/INTAKE-XXX-<SLUG>.md`
   - **OpenSpec (EARS + BDD)**: `openspec/specs/SPEC-XXX-<SLUG>.md` and `openspec/changes/CHANGE-XXX-<SLUG>.md`
     - Every Functional Requirement (`FR-XXX`) uses formal EARS patterns (`CUANDO ... EL SISTEMA ...`, `MIENTRAS ...`, `SI ... ENTONCES ...`, `EL SISTEMA ...`).
     - Every Acceptance Criterion (`BDD-XXX`) uses `ESCENARIO / DADO / CUANDO / ENTONCES / Y`.
   - **Architecture Plan & ADR**: `docs/plans/PLAN-XXX-<SLUG>.md` documenting rejected alternatives and Layer-0 hexagonal isolation.
   - **Atomic Task DAG**: `docs/tasks/TASKS-XXX-<SLUG>.md` with explicit done-criteria per task.
   - **Formal Model (for Control-Plane / Concurrency / Security protocols)**: `docs/formal/<ModelName>.tla` paired with a bounded deterministic simulation in `scripts/verify-formal-tla.mjs`.
   - **Authorization Record**: Entry in `IMPLEMENTATION_AUTHORIZATION.md` (`LEVEL 2` or `LEVEL 3`).

## 2. Clean / Hexagonal Layer-0 Implementation Rules (Law V & Law VII)

- **Zero External Runtime Dependencies**: `package.json` `"dependencies"` must remain empty (`0` packages). Use only Node.js built-ins (`node:fs`, `node:crypto`, `node:path`, `node:http`, etc.) and Layer-0 primitives (`src/core/eosKernelPrimitives.ts`).
- **Node 24 Strip-Only TypeScript Compatibility**: Do not use TypeScript `enum`, `namespace`, or constructor parameter properties (`constructor(private x: number)`). Use string literal union types and explicit class fields.
- **Design by Contract (DbC)**: Guard public domain methods with `assertPrecondition`, `assertPostcondition`, `deepFreeze`, and `pureSha256` receipts.
- **English Artifacts**: Write all code, identifiers, comments, specs, ADRs, and commit messages in professional English.

## 3. Verification Sequence

1. Run `eos_check_openspec` and `eos_simulate_bounded_models` via `call_mcp_tool` (`ServerName: "eos-system"`).
2. Run `npm run typecheck` (`tsc --project tsconfig.typecheck.json`) — treat any warning or error as blocking.
3. Add a dedicated `node:test` suite `test/<feature>.test.mjs` covering every `BDD-XXX` scenario.
4. Run `npm run test` (`scripts/verify-cicd-pipeline.mjs`) and confirm all 7/7 stages exit with code `0`.

## 4. LIDR Specboot 6-Phase Cycle & Javier Vargas's 4 Production SDD Laws

Integrate the production workflow patterns from `LIDR-academy-temp/lidr-specboot` (`SPEC-339` FR-7..FR-9):

1. **6-Phase OpenSpec + Specboot Cycle**:
   - **User Story** $\to$ **Refined User Story** (`/enrich-us` / `eos toolchain:harness:enrich`) $\to$ **Proposal** (`proposal.md`, `specs/`, `design.md`, `tasks.md`) $\to$ **Apply** (feature branch, TDD, mandatory pre/post DB baseline & restoration, agent-executed `curl` verification, Playwright MCP 4-category E2E suite when frontend is impacted) $\to$ **Review + PR** (`judgment-day` / independent adversarial review before archive) $\to$ **Verify + Archive**.
   - Idempotency check: skip re-enrichment when `[original]`/`[enhanced]` (or `## Original`/`## Enhanced`) already exist unless `forceReEnrich: true`.
2. **Javier Vargas's 4 Production SDD Laws**:
   - **Close Decisions First**: Ban vague hedges (`"si aplica"`, `"si es necesario"`, `"if applicable"`, `"if needed"`, `"maybe"`) and multi-goal sentences; block and emit clarifying questions until all business/technical decisions are closed.
   - **Smart Spec, Cheap Execution** (`eos toolchain:harness:multiagent`): Allocate Frontier high-reasoning models to `REFINER` and `ARCHITECT_PLANNER`, and fast/economical models to `IMPLEMENTER` and `INDEPENDENT_REVIEWER`.
   - **Architecture Shared Memory ($\le 200$ lines)**: Keep a compact living architecture contract ($\le 200$ lines) to avoid blind repo exploration tokens.
   - **Real Agent Self-Verification**: Pair unit suites with real integration/CLI/E2E verification and RTK token-compressed CLI diagnostics (`eos toolchain:harness:rtk`, targeting $\ge 60\%$ savings).

## 5. Harness Engineering & Token Economics Discipline (SPEC-377 / LIDR M5+M6)

Enforce Big Tech harness boundaries and token efficiency across Glorian and all 10 fleet repositories via `eos toolchain:token-econ:*` (Layer-0 pure, zero third-party proxy bloat):

1. **Forbidden-Touch & Blast-Radius Boundary (`eos toolchain:token-econ:boundary`)**: Before modifying code, declare `allowedPaths`, `forbiddenPaths`, `maxFilesTouched`, `maxDiffLines`, and `allowTestMutation`. Any violation fails closed (`HARD_BLOCK`) with a SHA-256 attestation.
2. **Structured MCP/JSON Payload Compression (`eos toolchain:token-econ:compress`)**: Fold homogeneous arrays into columnar tables, prune null/empty fields, and digest opaque hashes/base64 blobs (Headroom pattern, targeting $\ge 50\%$ token reduction).
3. **Closed-Set Deterministic Routing & Milestone Switching (`eos toolchain:token-econ:route`)**: Resolve closed-set triage deterministically (JEV pattern) with calibrated confidence; escalate to Frontier only when `confidence < threshold`, and switch models strictly at milestone boundaries (`PLANNING -> EXECUTION -> VERIFICATION`) to protect 90% prompt caching.
4. **Prompt Cache Prefix Hygiene & Context-Rot Guard (`eos toolchain:token-econ:cache`)**: Keep static prefixes (Constitution, `AGENTS.md`, `/docs`) free of timestamps, UUIDs, and dynamic counters; trigger compaction checkpoints whenever context fill reaches $\ge 70\%$.
5. **Anti-Overengineering Gate & Compact Agent IPC (`eos toolchain:token-econ:minimal`)**: Reject single-use speculative abstractions, pass-through wrappers, and unauthorized runtime dependencies (Ponytail pattern). Use compact telegraphic IPC frames strictly for agent-to-agent handoffs while preserving full Law VII professional English in all repository artifacts.

## 6. Goal-Driven Development & Parallel Software Factory (SPEC-378 / LIDR M7)

Couple SDD ("what to build") with deterministic GDD verification loops ("when it is done") via `eos toolchain:gdd:*`:

1. **Verifiable Output Contracts vs. Deferred Outcomes (`eos toolchain:gdd:goal`)**: Every execution goal must specify numeric `metricName`, `operator`, finite `threshold`, `unit`, executable `verifyCommand`, and hard caps (`maxAttempts`, `maxDurationMs`, `maxCostUsd`). Never close business **outcomes** on Day 0 (`reviewAfterDays >= 15` requires production user telemetry and Product sign-off).
2. **Immutable Verifier Guard (`eos toolchain:gdd:verifier`)**: Keep tests, `.github/workflows/**`, `scripts/verify-*.mjs`, and OpenSpec contracts outside implementation scope and verify SHA-256 digests remain unchanged (`HARD_BLOCK_TAMPERED` on mutation).
3. **Bounded Output Loops (`eos toolchain:gdd:loop`)**: Halt immediately when output criteria pass (`OUTPUT_VERIFIED`, never claiming `outcomeVerified: true` on Day 0) or when attempts, duration, cost, or token budgets exhaust, emitting a complete probe ledger.
4. **Parallel Isolated Worktree Factory (`eos toolchain:gdd:factory`)**: Run parallel `/factory` tasks strictly in disjoint `git worktree` paths, distinct branches, and non-overlapping `editSurfacePaths` under an aggregate cost cap.
5. **Three Mandatory Pre-PR Gates (`eos toolchain:gdd:gates`)**: Require (1) unit + E2E tests executed and passing, (2) independent adversarial review (`reviewerAgentId !== implementerAgentId`) with `0` `critical` findings, and (3) `/verify` completeness with intact verifiers. Treat `warning` and `suggestion` items as non-blocking advisories.
