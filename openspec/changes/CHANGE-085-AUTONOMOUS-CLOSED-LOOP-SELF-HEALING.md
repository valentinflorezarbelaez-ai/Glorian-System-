# CHANGE-085: Autonomous Closed-Loop Self-Healing & AST Mutation Engine (Level 5 Planetary Core)

## 1. Intent & Scope
Advance Glorian System from Level 4 (Sovereign Infrastructure) to Level 5 (Autonomous Planetary Core) by introducing an autonomous closed-loop self-healing engine. The engine automates fault isolation, AST candidate patch synthesis, hermetic sandboxed verification, and fail-closed promotion with cryptographic ledger receipts.

## 2. Affected Specifications
- `openspec/specs/SPEC-150-AUTONOMOUS-CLOSED-LOOP-SELF-HEALING.md` (Base Specification)
- `openspec/specs/SPEC-149-OPENTELEMETRY-DISTRIBUTED-TRACING.md` (Telemetry linkage)
- `openspec/specs/SPEC-142-WASM-MICROVM-AGENT-SANDBOXING.md` (Sandboxed verification)
- `openspec/specs/SPEC-145-REPOSITORY-KNOWLEDGE-GRAPH.md` (Causal blast radius)

## 3. Implementation Artifacts
- `src/core/eosAutonomousSelfHealingEngine.ts` (Core engine)
- `test/eosAutonomousSelfHealingEngine.test.mjs` (BDD-450..BDD-455)
- `src/mcp/eosMcpServer.ts` (Tools dispatch & OTel span tracking)
- `bin/eos.mjs` (CLI command `eos heal:loop [target]`)
- `src/ui/eosStudioConsole.html` (Interactive Cockpit module)
- `docs/contracts/mcp-tool-catalog.json` (Catalog contract update)

## 4. Verification Gate
- 100% pass rate on `test/eosAutonomousSelfHealingEngine.test.mjs` (BDD-450..BDD-455).
- Zero plain secrets, zero runtime npm dependencies.
- 7/7 Sovereign Gate stages exit code 0.
