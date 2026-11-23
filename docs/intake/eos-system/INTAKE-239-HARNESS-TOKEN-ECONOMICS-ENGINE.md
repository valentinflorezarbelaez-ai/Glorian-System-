# INTAKE-239: Harness Boundaries, Structured Token Economics & Deterministic Decision Router Engine

- **Project**: `eos-system-control-plane` (`Glorian System`)
- **Date**: 2026-11-22
- **Change / Spec**: `CHANGE-239` / `SPEC-377`
- **Status**: `INTAKE_COMPLETE`
- **Owner Approval**: Explicit owner directive on 2026-11-22 ("si dale con toda la perfeccion como harian los grandes qye sea perfecto")

## 1. Context & Problem Statement

Following the release of LIDR Agentic Engineer Starter 2027 Modules M4 (SDD in Demos), M5 (Harness Engineering), and M6 (Token Economics), an evidence-based architectural audit of Glorian System confirmed that Glorian already implements RTK terminal compression (`SPEC-339`), Specboot story enrichment (`SPEC-339`), RepoMap symbol compression (`SPEC-239`), AST context compression (`ADR-018`), and multi-model FinOps routing (`SPEC-118`, `SPEC-298`).

However, five high-leverage production engineering gaps remain that frontier organizations (Anthropic, Stripe, Google, Meta) enforce natively inside their agentic control planes without relying on fragile third-party proxies or restrictive licenses:

1. **Harness Forbidden-Touch & Blast-Radius Boundary Enforcement (M5)**: Specs define what to build; the harness must deterministically enforce what the agent is **forbidden to touch**, maximum files touched, maximum diff lines, and test-mutation boundaries.
2. **Structured MCP/JSON Payload Compression — Headroom Pattern (M6)**: Terminal output (`SPEC-339`) and source ASTs (`ADR-018`) are already compressed, but verbose JSON/MCP tool payloads (repetitive arrays of objects, null fields, long hashes/base64 blobs) account for 20%–60% of input context bloat.
3. **Deterministic Closed-Set Decision Classifier & Milestone-Boundary Model Router — JEV Pattern (M6)**: Closed-set classification and tier routing must execute deterministically at near-zero cost with calibrated confidence and safe escalation to Frontier only when uncertain, switching models strictly at milestone boundaries (`PLANNING -> EXECUTION -> VERIFICATION`) to preserve 90% prompt-cache hit rates.
4. **Prompt Cache Prefix Stability & Session Token Economics Auditor (M6)**: Input tokens represent 90%+ of agentic session cost. Dynamic tokens (timestamps, UUIDs, nonces) placed inside static system prefixes silently bust prompt caches, causing 10x cost spikes. Context-rot warnings must trigger before degradation.
5. **Anti-Overengineering Minimal-Diff Gate & Compact Agent-to-Agent IPC — Ponytail + Caveman Patterns (M6)**: Agents frequently introduce single-use speculative abstractions and verbose internal handoffs. A deterministic minimalism gate and compact agent-to-agent IPC frame encoder prevent bloat while preserving Law VII English quality for repository artifacts.

## 2. Constraints

- **Law V (Layer-0 Purity)**: Zero external runtime npm dependencies; Node.js built-ins (`node:crypto`, `node:fs`, `node:path`) only.
- **Node 24 Strip-Only TypeScript**: No `enum`, `namespace`, or constructor parameter properties.
- **SPEC-250 Module Size Budget**: Every `.ts`/`.mjs` module strictly `<= 800` lines (target `<= 650` lines) and cyclomatic complexity `<= 15`.
- **Law VII**: All repository code, specs, ADRs, tests, and commit messages in standard professional English.
