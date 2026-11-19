# CHANGE-225: Voice Neural Interface with Gemini Live API

**Change Identifier**: `CHANGE-225`  
**Specification Target**: `SPEC-363`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `PROPOSED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Description & Context

This change introduces `EosVoiceNeuralInterface`, an embedded Layer-0 real-time voice streaming and speech processing engine. It provides bidirectional voice interaction between operators and Glorian System using mathematical Voice Activity Detection (VAD), linear PCM framing, ephemeral session negotiation, and direct visual HUD integration in `EosGlorianLiveStudio`.

---

## 2. Delta Specification Summary

### Added Modules

- `docs/formal/VoiceNeuralInterface.tla`: Leslie Lamport TLA+ Model 106 modeling audio frame chunking, VAD state transitions, bidirectional voice streaming, and buffer overflow prevention invariants.
- `docs/formal/VoiceNeuralInterface.cfg`: TLC model configuration for Model 106.
- `src/core/eosVoiceNeuralInterface.types.ts`: TypeScript interfaces for voice session configuration, PCM audio frames, VAD metrics, and audit receipts.
- `src/core/eosVoiceNeuralInterface.ts`: Pure Layer-0 voice interface engine with DSP VAD calculation, streaming frame serializer, and HUD bridge.
- `bin/commands/cliVoiceNeuralInterface.mjs`: CLI router supporting `toolchain:voice:start`, `toolchain:voice:vad`, `toolchain:voice:stream`, and `toolchain:voice:audit`.
- `test/eosVoiceNeuralInterface.test.mjs`: Automated BDD test suite verifying `BDD-1957` through `BDD-1962`.

### Modified Modules

- `scripts/run-tlc.mjs`: Registered `"VoiceNeuralInterface"` in `CONFIGURED_SPECS`.
- `src/core/index.ts`: Exported `EosVoiceNeuralInterface` and associated types.
- `bin/commands/cliToolchainRouter.mjs`: Routed `toolchain:voice:*` commands.
- `bin/commands/cliHelpCatalog.mjs`: Documented new CLI commands.
- `src/core/eosMcpToolTaxonomy.ts`: Registered `eos_voice_neural_interface_audit`.
- `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`: Defined MCP schema.
- `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`: Implemented MCP execution handler.
- `docs/contracts/mcp-tool-catalog.json`: Updated MCP catalog.
- `IMPLEMENTATION_AUTHORIZATION.md`: Recorded `AUTH-2026-11-19-VOICE-NEURAL-INTERFACE`.

---

## 3. Backward Compatibility & Purity

- **Zero Runtime Dependencies**: Strict adherence to Node.js built-ins (`node:buffer`, `node:crypto`).
- **Clean Invariants**: Max lines $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
