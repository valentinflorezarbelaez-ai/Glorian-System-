# INTAKE-039: ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR & POLYGLOT TOPOLOGY ENGINE (v52.0.0)

* **Project**: `eos-system` (`EOS System — Sovereign Control Plane`)
* **Date**: 2026-10-30
* **Owner**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
* **Status**: `INTAKE_COMPLETE`
* **Target Specification**: `SPEC-046-ENTERPRISE-WORKSPACE-GOVERNOR.md`

---

## 1. Business & Principal Engineering Context

To operate as an authentic Tier-0 Engineering Operating System across real-world high-scale production codebases (polyglot monorepos, microservices, frontend/mobile apps, cloud-native backends, and AI/ML pipelines), EOS requires two mission-critical capabilities beyond single-repository self-governance:

1. **Deep Enterprise Polyglot Monorepo, Contract & Supply-Chain Discovery**:
   - Real enterprise repositories use multi-package workspace orchestrators (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `package.json#workspaces`, `Cargo.toml [workspace]`, `go.work`, `pyproject.toml` uv/poetry, `bazel`, `gradle`, `melos.yaml`), formal interface contracts (`OpenAPI/Swagger`, `Protocol Buffers .proto`, `GraphQL .graphql`, `JSON Schema`, `Prisma/SQL migrations`, `TLA+`), and supply-chain lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`, `uv.lock`).
   - Previous repository heuristics (`EosUniversalProjectAdapter`) stopped at depth 3 and scanned at most 50 files without enumerating internal workspace packages, API contract schemas, or lockfile determinism.

2. **Constitutional Law IV Safe Onboarding & Multi-Tenant Registered Fleet Resolution**:
   - Onboarding a new enterprise repository into EOS previously required manual editing of `docs/projects/registry.json`, `docs/intake/`, `docs/specs/`, and `docs/audits/`.
   - Furthermore, MCP tools in `EosMcpServer` resolved paths exclusively inside `eos-system`'s own `projectRoot`, preventing read-only architectural inspection and verification of registered external fleet workspaces (`crud-slack`, `aberamentho`, `portafolio`, `performance-talent-group`, or newly onboarded enterprise monorepos).
   - Under **Law IV (External Write Barrier)**, EOS must allow bounded, symlink-safe read-only inspection and control-plane-confined onboarding (`LEVEL_1_READ_ONLY_AUDIT` by default, zero writes inside the external target repository) while strictly blocking any external mutation unless all 6 Law IV preconditions and `LEVEL_2`+ owner authorization are verified.

---

## 2. Hard Invariants & Constraints

1. **Zero External Runtime Dependencies (Law V)**: Pure Layer-0 TypeScript (`src/core/eosEnterpriseWorkspaceGovernor.ts`) compatible with Node.js 24 strip-only TypeScript execution.
2. **Strict Law IV External Write Barrier**: Onboarding and inspection write zero bytes into the external target repository; control-plane artifacts (`docs/intake/<id>/`, `docs/specs/<id>/`, `docs/audits/<id>/`, `docs/projects/registry.json`) are confined strictly within `controlPlaneRoot`.
3. **Symlink & Traversal Immunity (Law VI)**: All filesystem scans reject symbolic links (`lstatSync().isSymbolicLink()`), enforce bounded file counts and byte budgets, and reject path traversal (`..`).
4. **Durable Cryptographic Auditability (Law III)**: Every onboarding and verification execution emits a deterministic 64-character SHA-256 receipt and records tamper-evident audit entries in `EosDurableSqliteLedger`.
