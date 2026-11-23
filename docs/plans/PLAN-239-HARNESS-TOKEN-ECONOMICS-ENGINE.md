# PLAN-239: Architecture Plan & ADRs — Harness Boundaries & Token Economics Engine (`SPEC-377`)

- **Spec**: `SPEC-377` (`CHANGE-239`)
- **Date**: 2026-11-22
- **Architecture Layer**: Layer-0 Pure Core (`src/core/`), CLI Adapter (`bin/commands/`), MCP Adapter (`src/mcp/tools/`)

---

## 1. Hexagonal Architecture & Module Boundaries

- **Domain / Core (Layer-0 Pure)**:
  - `src/core/eosHarnessTokenEconomicsCore.types.ts` (`<= 300` lines): Pure interfaces, type unions, deterministic glob matcher, token counter, and helper predicates.
  - `src/core/eosHarnessTokenEconomicsCore.ts` (`<= 580` lines): Stateless pure functions + `EosHarnessTokenEconomicsCore` facade + `audit()` generating `HARNESS_TOKEN_ECONOMICS_RECEIPT.json`.
  - Zero external npm packages (Law V); Node 24 strip-only TypeScript; cyclomatic complexity `<= 15` on every function.
- **Presentation / Adapters**:
  - CLI: `bin/commands/cliHarnessTokenEconomics.mjs` routed via `toolchain:token-econ:` prefix in `bin/commands/cliToolchainRouter.mjs`.
  - MCP: `eos_harness_token_economics_audit` registered in `eosMcpToolTaxonomy.ts`, `eosMcpPhase8ToolDefinitions.ts`, and `eosMcpPhase8AgiHandlers.ts`.
  - Skill Policy: `.agents/skills/eos-sdd-pipeline/SKILL.md` Section 5.

---

## 2. Architecture Decision Records (ADRs)

### ADR-239-001: Native Layer-0 Primitives vs. External Third-Party Token Proxies

- **Decision**: Implement structured JSON/MCP compression, closed-set decision classification, prompt-cache auditing, and minimal-diff gating natively in Layer-0 TypeScript (`node:crypto` only).
- **Rejected Alternative A**: Install third-party npm/binary proxies (`headroom`, `caveman`, `ponytail`, `jev-model-router`, `GitNexus`) directly into Glorian's runtime.
  - _Reason Rejected_: Violates EOS Constitution Law V (zero runtime dependencies), introduces external supply-chain attack surface, adds process-hop latency, and introduces restrictive PolyForm non-commercial licensing (`GitNexus`).
- **Rejected Alternative B**: Rely solely on natural-language prompt instructions to prevent agents from touching forbidden files or over-engineering.
  - _Reason Rejected_: Prompt instructions are probabilistic and fail under context pressure. Deterministic harness verification produces verifiable `ALLOW`/`HARD_BLOCK` verdicts with cryptographic evidence (Law III).

### ADR-239-002: Milestone-Boundary Model Switching to Preserve Prompt Cache (90% Discount)

- **Decision**: Enforce `modelSwitchAllowed = (previousPhase !== currentPhase) || !activeModelTier` inside `classifyAndRouteDecision()`.
- **Rejected Alternative**: Per-turn dynamic model swapping inside an active phase.
  - _Reason Rejected_: Switching models mid-turn invalidates provider KV/Prompt Cache prefixes, erasing the 90% cached-input discount and increasing total session cost despite cheaper per-token rates.

### ADR-239-003: Compact IPC Restricted Exclusively to Agent-to-Agent Handoffs

- **Decision**: Provide `encodeCompactAgentIpc()` strictly for machine/subagent internal telemetry frames while forbidding telegraphic truncation in repository docs, specs, code comments, or user-facing prose.
- **Rejected Alternative**: Apply global telegraphic compression to all outputs.
  - _Reason Rejected_: Violates EOS Constitution Law VII (standard professional English for all repository technical artifacts).
