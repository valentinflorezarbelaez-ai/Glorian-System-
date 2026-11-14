# INTAKE-121 — Live Git Diff Inspector, Polyglot RepoMap Symbol Compressor & Property-Based Shrinking Fuzzer

## Metadata

- **Intake ID**: INTAKE-121
- **Change ID**: CHANGE-121
- **Target Specs**: SPEC-238, SPEC-239, SPEC-240
- **Project**: Glorian System (EOS Control Plane)
- **Date**: 2026-11-13
- **Status**: `INTAKE_COMPLETE`
- **Authorization Level Required**: `LEVEL 3`

---

## 1. Context & Problem Statement

To close the final gaps evaluated by top-tier Big Tech engineering organizations and verification consortiums (Google, Spotify, Cloudflare, OpenSSF, NASA IV&V):

1. **Live Local Git Diff Inspection (`SPEC-238`)**: Instead of relying exclusively on manual arrays, Jarvis needs a Layer-0 inspector that inspects the real local Git workspace (`git diff --numstat` / live patches), detects credential leaks and destructive DDL in added lines, enforces the Beyoncé Rule, and packages `.eos/pr-ready-bundle.md`.
2. **Token-Budget Polyglot RepoMap Compression (`SPEC-239`)**: In large monorepos (thousands of files across TS/JS/Go/Python/Java/Rust), loading entire files wastes context tokens. A Layer-0 symbol extractor + graph centrality ranker (`inDegree * 3 + symbols.length`) compresses exported interfaces, classes, and function signatures to fit strictly inside a caller-chosen token budget (`maxTokenBudget`).
3. **Deterministic Property-Based Testing with Counterexample Shrinking (`SPEC-240`)**: Beyond scenario-based BDD checks, critical invariants benefit from QuickCheck/Hypothesis-style seeded fuzzing that shrinks failing numeric or string counterexamples down to the minimal failing input.
4. **Master Ship Readiness Command (`glorian ship`)**: Unified CLI (`ship`) and MCP (`jarvis_ship_readiness`) pipeline combining `SPEC-236`, `SPEC-237`, `SPEC-238`, `SPEC-239`, and `SPEC-240`.
