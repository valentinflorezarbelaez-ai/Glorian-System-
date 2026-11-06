# SPOTIFY & NUBANK DUAL-ENGINE CONTEXT MATRIX: EOS-SYSTEM-CONTROL-PLANE (APEX CODEX)
<!-- Generated programmatically by EOS Spotify Agentic Factory (SPEC-012, SPEC-014, SPEC-023, SPEC-024) -->
<!-- DO NOT EDIT MANUALLY. Run 'eos xirp sync' to update. -->

## 1. Backstage Component Profile
- **Component ID**: `eos-system-control-plane`
- **Component Title**: EOS System (Engineering Operating System)
- **Owner Squad**: `user:valentin-florez-arbelaez`
- **Tribe**: `Core-Experience`
- **Lifecycle Tier**: `production`
- **Registered Fleet Repositories**: 4
- **Active Formal Architectural Specs (OpenSpec)**: 44

## 2. The Nubank Institutional Engineering Doctrine (building.nu.com Standard)
1. **Fighting Complexity & Simplicity as Discipline**: Simplicity (unbraided, decoupled) over easiness (familiar but tangled). Out of the Tar Pit: separate essential business logic from state and control flow.
2. **Clojure Idioms & Functional Purity**: Data-oriented programming with immutable maps, vectors, sets. Concurrency managed explicitly via STM, atoms (`swap!`), or lock-free sequencers.
3. **Datomic Bitemporal Immutable Ledger**: The database is an immutable value. Append-only datom facts (`[entity, attribute, value, tx, added?]`). Forensic time-travel via `(d/as-of db t)` and `(d/history db)` with zero destructive writes.
4. **Hexagonal Architecture & Hermetic Isolation**: 100% pure core domain isolated behind explicit ports & adapters (Finagle/Pedestal HTTP, Kafka, Datomic). No shared databases across microservices.
5. **Kafka Event Streaming & Banking-Grade Idempotency**: Partitioning by entity ID (`account_id`) for ordered delivery. Mandatory unique idempotency tokens (`Idempotency-Key`) guaranteeing 0 duplicate charges in O(1).
6. **Consumer-Driven Contracts (The Sachem Pattern)**: Elimination of brittle multi-service E2E staging environments. Backward compatibility enforced via automated schema validation in CI/CD.

## 3. The Spotify Institutional Engineering Doctrine (engineering.atspotify.com Standard)
1. **Golden Paths & Backstage (Anti-"Rumour-Driven Development")**: Supported, opinionated, opt-in happy paths baking in security, CI/CD, and monitoring out-of-the-box. Soundcheck automated compliance scoring (0-100).
2. **Aligned Autonomy & The Spotify Model**: Squads, Tribes, Chapters, Guilds. "Loosely coupled, tightly aligned": high alignment enables extreme autonomy. Open RFC-42 consensus across global engineering hubs.
3. **Event Delivery Infrastructure (EDI) at Trillion-Scale**: Trillion-scale event ingestion via Cloud Pub/Sub, Dataflow, BigQuery, and Kafka with self-service Protobuf schemas and deduplication.
4. **Acoustic Science & ITU-R BS.1770 Audio Standards**: Inviolable target: **-14.0 LUFS** integrated loudness with a **-1.0 dBTP** true peak ceiling. Equal-power gapless crossfades (sin^2 + cos^2 = 1.0) and lockless streaming buffers.
5. **Continuous Experimentation & Progressive Canary Delivery**: A/B testing with sequential statistical analysis. Canary rollouts (1% -> 5% -> 25% -> 100%) with automated fail-closed Prometheus kill-switches (error rate > 0.1%).
6. **Fleetshift Autonomous Mass Migrations & Blameless SRE**: Fleet-wide automated refactoring (Fleetshift), background coding agents (Honk), and blameless postmortems with the 5 Whys.

## 4. The 90 / 10 Architecture Doctrine
- **90% in Go / Clojure (The High-Scale Nervous System)**: High-concurrency microservices, idempotent event processors, CNCF health probes, FinOps distroless containers (< 12MB), and business APIs.
- **10% in Rust (The Heavy Motor)**: Lockless audio DSP kernels, ITU-R BS.1770 -14.0 LUFS loudness normalizers, and SIMD acoustic vector filters.

## 5. The 4 Fundamental Laws of Engineering (Spotify & Nubank Standard)
1. **Principle of Extreme Ownership (Act Like an Owner)**: Every line of code is written as if cloud server bills were paid from our own pocket. Zero temporary hacks.
2. **FinOps, Distroless & Zero-Allocation**: Production Go services must compile to static stripped binaries (`-ldflags="-s -w"`) inside Distroless containers (< 12MB) targeting 0 allocations (`0 B/op`).
3. **Shift-Left Rigor & Concurrency Safety**: Code must pass data race detection (`go test -race ./...`) before deployment. Formatting is strictly enforced via `gofmt -s -w .`.
4. **Event-Driven & Banking/Royalty Idempotency**: All financial and streaming mutations must enforce idempotent deduplication tokens to guarantee zero duplicate charges or royalty allocations.

## 6. Inviolable Engineering Invariants
1. **Zero Vibe Coding**: All code changes must trace directly to formal EARS requirements in `openspec/specs/`.
2. **Layer-0 Purity**: Production modules must preserve zero external dependencies (`dependencies: {}`).
3. **Audio Standards**: LUFS normalization strictly targets **-14.0 LUFS** with a **-1.0 dBTP** true peak ceiling.
4. **Asynchronous Communication**: Cross-squad contracts (Stockholm/London/NYC/São Paulo/Bogotá) must be documented in code comments and Backstage catalogs.
5. **No Plaintext Secrets**: Hardcoded credentials result in immediate CI/CD rejection.

## 7. EOS AGI Frontier Harness (SPEC-047 — v51.0.0)

The EOS AGI Harness provides four frontier-level capabilities accessible via CLI and MCP:

### CLI Commands
- `eos agi [axioms|rules]` — Show crystallized axioms learned from past failed branches
- `eos consult "<problem>"` — Full consulting deliverable: 5-Whys, ADR, code, risk matrix, FinOps
- `eos solve "<problem>"` — Quick alias for immediate consulting answer
- `eos forge [list|mcp|destroy]` — Manage dynamically forged MCP tools

### MCP Tools (invoke via Cursor / Claude Code)
- `eos_consult` — World-class consulting deliverable offline (no API key needed)
- `eos_agi_axioms` — Get learned rules to prevent repeat errors in prompts
- `eos_forge_list` — List all runtime-forged MCP tools
- `eos_forge_tool` — Create a new MCP tool from ESM source at runtime

### Architecture
- **EosAgiCore**: Tree of Thoughts + Deterministic Tribunal (Exit Code 0 = law) + Episodic Axiom Memory
- **EosMultiModelRouter**: Routes tasks by type to optimal model (Anthropic/Google/DeepSeek) with caching + rate limiting
- **EosDynamicToolForge**: If the AGI lacks a tool, it writes, validates, registers, and uses it in one cycle
- **EosConsultantCore**: Offline consulting at Thoughtworks/McKinsey level — no API call needed
