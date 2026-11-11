# CHANGE-094: Layer-0 Streaming Isolation Forest Anomaly Detector

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Governed Spec**: `SPEC-209`
- **Related Requirements**: FR-1064, FR-1065, FR-1066, FR-1067, FR-1068
- **Related Scenarios**: BDD-1064, BDD-1065, BDD-1066, BDD-1067, BDD-1068

---

## 1. Description of Change

Introduces `EosIsolationForestDetector` (`src/core/eosIsolationForestDetector.ts`), implementing a sovereign, zero-dependency, streaming Isolation Forest unsupervised anomaly detector in pure TypeScript.

Key Capabilities:
1. Recursive Isolation Tree (`EosIsolationTree`) builder partitioning random feature attributes at random uniform split values.
2. Height limit bounds $h_{\max} = \lceil \log_2(\psi) \rceil$ and BST average path adjustment $c(n)$.
3. Normalized anomaly score calculation $s(x, \psi) = 2^{-\mathbb{E}(h(x)) / c(\psi)}$.
4. Streaming sliding window buffer adapting to online temporal drift in metric streams.
5. Multi-feature anomaly explanation identifying which features contributed most to isolation.
6. Subpath export `"./isolation-forest"` in `package.json` and barrel export in `src/core/index.ts`.
7. CLI commands `anomaly:detect` and `anomaly:forest` in `bin/commands/cliPlatform.mjs`.
8. MCP tools `anomaly_detect` and `anomaly_forest` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
9. Cryptographic SHA-256 anomaly receipts.
