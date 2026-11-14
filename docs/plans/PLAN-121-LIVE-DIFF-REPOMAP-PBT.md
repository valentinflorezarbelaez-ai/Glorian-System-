# PLAN-121 — Architecture & Design Decisions (`SPEC-238`, `SPEC-239`, `SPEC-240`)

## Metadata

- **Plan ID**: PLAN-121
- **Change ID**: CHANGE-121
- **Specs**: SPEC-238, SPEC-239, SPEC-240
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Design

Modules 53, 54, and 55 live inside pure Layer-0 (`src/core/`) with zero third-party runtime dependencies:

1. **`EosLiveGitDiffPrInspectorCore` (`SPEC-238`)**: Bridges live `git diff --numstat` / added patch lines into `EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety` with strict path confinement and dynamic non-triggering credential regex construction.
2. **`EosRepoMapSymbolCompressorCore` (`SPEC-239`)**: Extracts polyglot declarations via bounded regexes, constructs a directed relative import graph, computes centrality rank (`inDegree * 3 + symbols.length`), and fills markdown entries up to `maxTokenBudget`.
3. **`EosPropertyBasedShrinkingFuzzerCore` (`SPEC-240`)**: Deterministic `xorshift32` PRNG + numeric binary search shrinker + string halving/deletion shrinker, exposing `runBuiltInSuite` for pre-ship verification.

---

## 2. Architectural Decision Records (ADRs)

### ADR-121-001: Always Enforce Path Confinement & Dynamic Regex Patterns for Credential Detectors

- **Decision**: Construct secret-detection regex patterns dynamically from segments and confine `repoPath`, `targetDir`, and `bundleRelPath` inside `projectRoot`.
- **Rejected Alternative**: Writing raw vendor secret literals or regex constants in source files (which causes self-scanner false positives) or trusting caller paths unconditionally.

### ADR-121-002: Rank RepoMap Symbols by Graph In-Degree Without External AST Libraries

- **Decision**: Compute `inDegree` from resolved relative imports across polyglot extensions and weight `inDegree * 3 + symbols.length` using zero dependencies.
- **Rejected Alternative**: Adding Tree-sitter WASM binaries into `dependencies`, breaking Layer-0 (`dependencies: {}`).

### ADR-121-003: Deterministic Seeded Shrinking (`xorshift32`) Over Non-Deterministic Random Generators

- **Decision**: Require reproducible `seed`-based generators so every bug counterexample can be replayed identically across developer machines and CI runners.
- **Rejected Alternative**: Using `Math.random()`, making CI counterexamples irreproducible.

### ADR-121-004: Compose All Verifiers Under Master `glorian ship` / `jarvis_ship_readiness`

- **Decision**: Expose `ship` as a non-mutating pre-ship readiness command combining live diff, RepoMap, PBT suite, Staff Judge, and Canary rollback plan.
- **Rejected Alternative**: Requiring engineers to run five unrelated CLI flags manually before pushing.
