# SPEC-377: Harness Boundaries, Structured Token Economics & Deterministic Decision Router Engine

**Status**: `APPROVED`
**Version:** 1.0.0  
**Phase:** 8 (Layer-0 Pure Agentic Harness & FinOps Architecture)  
**TLA+ Model:** Model 120 (`docs/formal/HarnessTokenEconomics.tla`)  
**Merge Gate:** `npm run verify:strict`

---

## 1. Scope & Functional Requirements (EARS)

### FR-377-01: Declarative Harness Forbidden-Touch & Blast-Radius Boundary Enforcer

- **WHEN** a candidate change set (`changedFiles`, `totalLinesAdded`, `totalLinesDeleted`) is evaluated against a `HarnessBoundaryContract` (`allowedPaths`, `forbiddenPaths`, `maxFilesTouched`, `maxDiffLines`, `allowTestMutation`), **THE SYSTEM** shall evaluate every changed file deterministically and return `verdict: "HARD_BLOCK"` if any file matches `forbiddenPaths`, falls outside non-empty `allowedPaths`, violates `allowTestMutation === false` on test files, or exceeds `maxFilesTouched` or `maxDiffLines`; otherwise **THE SYSTEM** shall return `verdict: "ALLOW"` with a 64-character SHA-256 attestation.

### FR-377-02: Structured MCP/JSON Payload Compressor (Headroom Pattern)

- **WHEN** an arbitrary JSON/MCP payload (`unknown`) is passed to `compressStructuredPayload()`, **THE SYSTEM** shall recursively strip `null`/`undefined`/empty-string fields, fold long opaque strings (base64/hex hashes exceeding threshold) into deterministic length-preserving digests, convert homogeneous arrays of objects into compact columnar tables (`{ __format: "columnar_table", columns, rows, totalRows, truncatedRows }`), bound array length with head+tail retention, and return exact token metrics (`tokensBefore`, `tokensAfter`, `savingsPercent`, `schemaSummary`) without external dependencies.

### FR-377-03: Deterministic Closed-Set Decision Classifier & Milestone-Boundary Router (JEV Pattern)

- **WHEN** a closed-set decision query (`prompt`, `labels`, `currentPhase`, `previousPhase`, `activeModelTier`, `confidenceThreshold`) is evaluated by `classifyAndRouteDecision()`, **THE SYSTEM** shall score candidate labels deterministically, emit calibrated `confidence` in `[0, 1]`, escalate (`escalatedToFrontier: true`) if `confidence < confidenceThreshold`, and compute the target model tier (`DETERMINISTIC_LOCAL`, `BALANCED_SONNET`, `FRONTIER_OPUS`) while forbidding mid-turn model switches (`modelSwitchAllowed === false` whenever `currentPhase === previousPhase` and `activeModelTier` is already set) to preserve prompt-cache continuity.

### FR-377-04: Prompt Cache Prefix Stability & Session Token Economics Auditor

- **WHEN** static prefix segments, dynamic suffix segments, and session turn telemetry (`turns`, `contextWindowTokens`, `inputCostPer1MUsd`, `cachedInputDiscount`) are audited via `auditPromptCacheAndEconomics()`, **THE SYSTEM** shall detect cache-busting patterns inside static prefixes (ISO timestamps, UUID v4/hex IDs, dynamic request counters, volatile epoch numbers), compute `cachePrefixStable`, projected `promptCacheHitRate`, `contextFillRatio`, `contextRotAlert` (`true` when `contextFillRatio >= 0.70`), and USD cost comparison (`naiveCostUsd` vs `optimizedCostUsd`, `savingsUsd`, `savingsPercent`).

### FR-377-05: Anti-Overengineering Minimal-Diff Gate & Compact Agent-to-Agent IPC Encoder (Ponytail + Caveman Patterns)

- **WHEN** a candidate diff or source snippet is evaluated by `evaluateMinimalDiffAndIpc()`, **THE SYSTEM** shall flag speculative single-use abstractions (helper functions/classes declared and referenced fewer than 2 times), pass-through wrapper functions, excessive diff bloat ratio, and unauthorized runtime dependency additions, producing `minimalismVerdict` (`PASS` or `FAIL_OVERENGINEERED`), and shall encode structured inter-agent handoff payloads into deterministic ultra-compact telegraphic IPC frames (`encodeCompactAgentIpc`) measuring IPC token reduction.

### FR-377-06: Non-Vacuous Invariant Audit & SHA-256 Receipt Generation

- **WHEN** `EosHarnessTokenEconomicsCore.audit()` is invoked, **THE SYSTEM** shall execute live assertions across all five core invariants (`boundaryEnforced`, `structuredCompressionEffective`, `decisionRouterCacheSafe`, `cacheBreakerDetected`, `minimalismGateEnforced`), compute a 64-character SHA-256 receipt hash, and persist `docs/evidence/HARNESS_TOKEN_ECONOMICS_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (BDD-2049..BDD-2056)

### BDD-2049: Harness Boundary Enforcer Blocks Forbidden Paths & Excess Blast Radius

- **GIVEN** a `HarnessBoundaryContract` with `allowedPaths: ["src/core/**"]`, `forbiddenPaths: ["src/auth/**", "package-lock.json"]`, `maxFilesTouched: 3`, and `allowTestMutation: false`,
- **WHEN** `evaluateHarnessBoundary()` inspects a diff touching `src/auth/jwt.ts` and `test/auth.test.mjs`,
- **THEN** it returns `verdict: "HARD_BLOCK"` with explicit `FORBIDDEN_PATH` and `TEST_MUTATION_BLOCKED` violations and a valid 64-char `attestationHash`.

### BDD-2050: Harness Boundary Enforcer Allows Clean Scoped Changes

- **GIVEN** the same `HarnessBoundaryContract`,
- **WHEN** `evaluateHarnessBoundary()` inspects a diff touching only `src/core/billing.ts` with 45 changed lines,
- **THEN** it returns `verdict: "ALLOW"`, `violations: []`, and `blastRadiusSafe: true`.

### BDD-2051: Structured Payload Compressor Achieves High Token Reduction on Repetitive MCP/JSON

- **GIVEN** a verbose MCP JSON payload containing 60 homogeneous tool records with repeated keys, null properties, and 128-character hex tokens,
- **WHEN** `compressStructuredPayload()` runs with `maxArrayItems: 10`,
- **THEN** homogeneous arrays fold into `columnar_table`, null fields are pruned, long opaque tokens are digested, and `savingsPercent >= 50`.

### BDD-2052: JEV Decision Classifier Routes Deterministically & Protects Prompt Cache Across Turns

- **GIVEN** a closed-set routing query within an active `EXECUTION` phase (`previousPhase: "EXECUTION"`, `activeModelTier: "BALANCED_SONNET"`),
- **WHEN** `classifyAndRouteDecision()` evaluates a clear classification prompt and an ambiguous prompt,
- **THEN** the clear prompt resolves deterministically with `escalatedToFrontier: false` and `modelSwitchAllowed: false` (preserving prompt cache), while the ambiguous prompt sets `escalatedToFrontier: true` and switching is permitted only when `currentPhase !== previousPhase`.

### BDD-2053: Prompt Cache Auditor Detects Dynamic Cache-Breakers & Context Rot

- **GIVEN** static prefix segments containing an embedded ISO timestamp (`2026-11-22T19:30:00Z`) and UUID, plus session metrics at 78% context window fill across 12 turns,
- **WHEN** `auditPromptCacheAndEconomics()` runs,
- **THEN** `cachePrefixStable === false`, `cacheBreakers.length >= 2`, `contextRotAlert === true`, and `optimizedCostUsd < naiveCostUsd`.

### BDD-2054: Minimal-Diff Gate Rejects Single-Use Speculative Abstractions & Compacts Agent IPC

- **GIVEN** a candidate patch introducing an unused wrapper helper and an external dependency alongside a verbose inter-agent JSON handoff message,
- **WHEN** `evaluateMinimalDiffAndIpc()` and `encodeCompactAgentIpc()` execute,
- **THEN** `minimalismVerdict === "FAIL_OVERENGINEERED"` lists the speculative abstraction finding, and `encodeCompactAgentIpc()` produces a compact frame with `savingsPercent >= 35`.

### BDD-2055: CLI Toolchain Handlers Execute Cleanly Under `toolchain:token-econ:*`

- **GIVEN** the CLI dispatcher `bin/commands/cliHarnessTokenEconomics.mjs`,
- **WHEN** `toolchain:token-econ:boundary`, `toolchain:token-econ:compress`, `toolchain:token-econ:route`, `toolchain:token-econ:cache`, `toolchain:token-econ:minimal`, and `toolchain:token-econ:audit` are invoked with `--json`,
- **THEN** each handler emits valid JSON with exit-clean execution and deterministic metrics.

### BDD-2056: Cryptographic Audit Receipt & Phase-8 MCP Registration

- **GIVEN** `EosHarnessTokenEconomicsCore` and the Phase-8 MCP registry,
- **WHEN** `eos_harness_token_economics_audit` is invoked,
- **THEN** it returns `status: "VERIFIED"`, all 5 formal invariant flags `true`, a 64-char SHA-256 `receiptHash`, and writes `HARNESS_TOKEN_ECONOMICS_RECEIPT.json`.
