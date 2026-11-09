# CHANGE-019: CLIENT-SIDE GO WEB-ASSEMBLY & 3D SOVEREIGN TOPOLOGY ENGINE

- **Change ID**: `CHANGE-019`
- **Specification**: `SPEC-026-WASM-TOPOLOGY-GRAPH`
- **Plan**: `PLAN-019`
- **Date**: 2026-10-25
- **Author**: Valentín Flórez Arbeláez
- **Status**: `PROPOSED`

---

## 1. Summary of Changes

1. **Go WebAssembly Bridge**:
   - Create `src/native/eos_wasm_bridge.go` exporting `eosEstimateTokens`, `eosCompressContext`, `eosBenchmarkGo`, and `eosAnalyzeTopology`.
   - Compile to `assets/eos_apex.wasm` using `GOOS=js GOARCH=wasm go build -ldflags="-s -w"`.
   - Vend `js/wasm_exec.js` from Go distribution.
2. **Core TypeScript WASM Engine & Topology Core**:
   - Create `src/core/eosWasmEngine.ts` with asynchronous initialization, WASM bindings, and Layer-0 fallback.
   - Create `src/core/eosFleetTopology.ts` modeling the 14-node Sovereign fleet, 3 concentric rings, and blast radius calculations.
3. **Landing Page UI & 3D Interactive Canvas**:
   - Add `#eos-fleet-topology-canvas` in `index.html` within a high-tech glass card with interactive telemetry HUD.
   - Implement Canvas 3D rendering engine in `js/eos.js` supporting mouse orbit rotation, particle pulses, and node inspection.
   - Add styles in `css/eos.css` guaranteeing zero layout shift (CLS < 0.01).
4. **Verification & Testing**:
   - Create `test/eosWasmTopology.test.mjs` verifying node graph data structures, blast radius calculation, WASM export interface, and fallback conformance.
   - Update `scripts/verify-cicd-pipeline.mjs` to register the new test suite.
   - Update SRI integrity hashes via `node scripts/verify-sri-integrity.mjs --fix`.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_
