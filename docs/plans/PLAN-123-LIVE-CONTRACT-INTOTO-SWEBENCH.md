# PLAN-123 — Architecture Plan & ADRs (`CHANGE-123` / `SPEC-244`..`SPEC-246`)

## Metadata

- **Plan ID**: PLAN-123
- **Change Ref**: CHANGE-123
- **Target SPECs**: SPEC-244, SPEC-245, SPEC-246
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Modules 59–61 remain isolated inside `src/core/` using only Node.js built-ins (`node:child_process`, `node:crypto`, `node:fs`, `node:path`) and sibling `./*.ts` core modules. CLI dispatch resides in `bin/commands/cliJarvisPolyglotFrontierMesh.mjs` and MCP dispatch resides in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`.

---

## 2. Architectural Decision Records (ADRs)

### ADR-123-001 — Confined Git History Pair Resolution (`git show <baseRef>:<path>`)

- **Decision**: Confine workspace paths to `projectRoot`, validate `baseRef` strictly before invoking `execFileSync("git", ...)`, and feed real baseline/disk file pairs into `EosApiContractSemanticDiffCore`.
- **Rejected Alternative**: Invoking shell interpolation (`execSync`) or trusting caller-provided unvalidated git flags.

### ADR-123-002 — Native Node Ed25519 DSSE / In-Toto Statement v1 Without Dependencies

- **Decision**: Construct standards-compliant DSSE v1 (`DSSEv1` PAE) envelopes over In-Toto Statement v1 + SLSA Provenance v1.0 using Node's built-in `crypto.createPrivateKey` / `crypto.sign` / `crypto.verify` Ed25519 primitives.
- **Rejected Alternative**: Importing external `@sigstore/*` or `jose` npm packages, which violates Layer-0 `dependencies: {}`.

### ADR-123-003 — Multi-Engine Adversarial Golden SWE Corpus

- **Decision**: Drive the real Layer-0 engines (`EosLiveGitDiffPrInspectorCore`, `EosApiContractSemanticDiffCore`, `EosPropertyBasedShrinkingFuzzerCore`, `EosFleetMultiRepoShipOrchestratorCore`) in the built-in 8-case corpus rather than mocked static booleans.
- **Rejected Alternative**: Returning hardcoded constant benchmark scores unrelated to live module behavior.
