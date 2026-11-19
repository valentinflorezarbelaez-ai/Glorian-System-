# PLAN-225: Architectural Plan for Voice Neural Interface with Gemini Live API

**Document ID**: `PLAN-225-VOICE-NEURAL-INTERFACE`  
**Specification Target**: `SPEC-363` / `CHANGE-225`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Philosophy & Pure Layer-0 DSP

`EosVoiceNeuralInterface` introduces real-time voice intelligence to Glorian System without breaking the inviolable constraint of **Zero External Runtime Dependencies** (`dependencies: {}`).

### 1.1 In-Memory DSP (Digital Signal Processing)

Rather than delegating VAD to binary packages (e.g. Silero VAD, WebRTC C++ bindings, or Sox), the engine implements a deterministic DSP algorithm directly over typed integer arrays:

1. **RMS Energy Computation**:
   $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} x[i]^2}$$
2. **Zero-Crossing Rate (ZCR)**:
   $$\text{ZCR} = \frac{1}{2(N-1)} \sum_{i=1}^{N-1} |\text{sgn}(x[i]) - \text{sgn}(x[i-1])|$$
3. **Dual-Threshold Hysteresis State Machine**:
   - $\text{RMS} > E_{\text{start}} \land \text{ZCR} > Z_{\text{start}} \implies \text{SPEECH\_START}$
   - $\text{RMS} > E_{\text{continue}} \implies \text{SPEECH\_CONTINUOUS}$
   - Consecutive silence frames $> K_{\text{hangover}} \implies \text{SPEECH\_END} \to \text{SILENCE}$

---

## 2. Architecture Decision Record (ADR-225-001)

### Title

**ADR-225-001: Native TypedArray Audio DSP & Web Audio Bridge vs Native C++ Binaries**

### Status

`ACCEPTED`

### Context

Real-time audio processing conventionally relies on native addons (`node-gyp`, `node-speaker`, `node-record-lpcm16`) or heavyweight ML models in Python. These create platform-specific compilation hurdles on Windows/ARM64 and violate Layer-0 purity.

### Decision

Implement audio frame ingestion, RMS energy calculation, zero-crossing rate VAD, and Gemini Live message formatting entirely in standard TypeScript utilizing `Int16Array`, `Float32Array`, and `node:buffer`.
For microphone input and speaker output, provide a Web Audio API bridge directly inside the `EosGlorianLiveStudio` HUD (`SPEC-361`), capturing microphone PCM in the browser and streaming frames to the local server over WebSocket / SSE.

### Consequences

- **Positive**: Zero external binaries; cross-platform on any OS; sub-1ms VAD execution; formal verification via Leslie Lamport TLA+ model.
- **Negative**: Deep neural network speech separation (e.g. noisy background isolation) is simplified to spectral/energy hysteresis.

---

## 3. Rejected Alternatives

1. **Native WebRTC C++ Addon**:
   - _Rejected_: Requires `node-gyp`, Python, and C++ toolchains, failing on clean installs and violating `dependencies: {}`.
2. **Separate Python Flask Audio Proxy**:
   - _Rejected_: Requires a secondary Python runtime and cross-process IPC, increasing latency and failure modes.
