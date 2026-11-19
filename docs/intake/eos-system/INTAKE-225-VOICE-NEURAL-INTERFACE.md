# INTAKE-225: Voice Neural Interface with Gemini Live API (Bidirectional Real-Time Voice Streaming, VAD & HUD Integration)

**Document ID**: `INTAKE-225-VOICE-NEURAL-INTERFACE`  
**Target Specification**: `SPEC-363` / `CHANGE-225`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Lifecycle Tier**: `production`  
**Target Delivery Date**: 2026-11-19  
**Status**: `INTAKE_COMPLETE`  
**Level Authorization Required**: `LEVEL_3_PRODUCTION_AUTHORIZED`

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Keyboard Input Bottleneck in Real-Time System Steering

While Glorian System now features an interactive real-time visual HUD (`SPEC-361`) and an autonomous 24/7 background sentinel daemon (`SPEC-362`), interaction with the system remains fundamentally bound to **text typing latency**:

1. **High Friction in Incident Response**: When a high-severity alert triggers or an architectural question arises during flight, typing complex queries introduces 5-15 seconds of cognitive overhead.
2. **Lack of Conversational Flow**: True co-engineering requires bidirectional, low-latency vocal dialogue: talking through trade-offs, interrupting speech organically when critical updates occur, and receiving spoken telemetry digests.
3. **External Cloud Dependency vs Pure Layer-0 Architecture**: Existing speech packages depend on heavy native C++ binaries (e.g. node-record-lpcm16, sox, portaudio) or proprietary SDK wrappers, violating the strict `dependencies: {}` invariant.

Glorian System requires `EosVoiceNeuralInterface`:

- A 100% Layer-0 pure TypeScript audio DSP engine with built-in energy & zero-crossing Voice Activity Detection (VAD).
- Streaming bidirectional frame exchange protocol compatible with the Gemini 3.8 / 2.0 Live API.
- Integrated Web Audio API microphone capture and real-time audio playback within the `EosGlorianLiveStudio` HUD.
- Sub-100ms processing latency with strict frame boundary alignment.

---

## 2. Strategic Objectives & Architectural Requirements

1. **Pure Layer-0 In-Memory Audio Processing**:
   Processes raw linear PCM 16-bit mono audio at 16kHz or 24kHz using native `node:buffer` and typed arrays (`Int16Array`, `Float32Array`).
2. **Mathematical Voice Activity Detection (VAD)**:
   Calculates Root-Mean-Square (RMS) signal energy and Zero-Crossing Rate (ZCR) with hysteresis thresholds to reliably segment speech bursts from background silence.
3. **Bidirectional Streaming Protocol**:
   Handles asynchronous audio chunks, framing headers, ephemeral session tokens, and Gemini Live message serialization.
4. **Live Studio Visual HUD Integration**:
   Embeds an interactive microphone waveform visualizer and push-to-talk / voice activity toggle in the single-page HUD.
5. **Leslie Lamport Formal Verification**:
   TLA+ Model 106 (`docs/formal/VoiceNeuralInterface.tla` / `.cfg`) modeling client audio framing, VAD state transitions, and buffer overflow prevention invariants.
