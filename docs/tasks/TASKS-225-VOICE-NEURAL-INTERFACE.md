# TASKS-225: Implementation Checklist for Voice Neural Interface with Gemini Live API

**Document ID**: `TASKS-225-VOICE-NEURAL-INTERFACE`  
**Specification Target**: `SPEC-363` / `CHANGE-225`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `COMPLETED`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-225-VOICE-NEURAL-INTERFACE.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-225-voice-neural-interface.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-363-voice-neural-interface.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-225-VOICE-NEURAL-INTERFACE.md` with ADR-225-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-225-VOICE-NEURAL-INTERFACE.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 106 (`docs/formal/VoiceNeuralInterface.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosVoiceNeuralInterface.types.ts` defining PCM frames, VAD states, streaming events, and audit receipts ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosVoiceNeuralInterface.ts` implementing DSP VAD analysis, circular audio buffer, Gemini Live frame serializer, and HUD audio bridge ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliVoiceNeuralInterface.mjs` supporting `toolchain:voice:start`, `toolchain:voice:vad`, `toolchain:voice:stream`, and `toolchain:voice:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_voice_neural_interface_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosVoiceNeuralInterface.test.mjs` verifying `BDD-1957` through `BDD-1962`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [x] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
