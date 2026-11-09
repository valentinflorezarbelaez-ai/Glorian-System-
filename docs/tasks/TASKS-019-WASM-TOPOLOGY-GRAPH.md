# TASKS-019: CLIENT-SIDE GO WEB-ASSEMBLY & 3D SOVEREIGN TOPOLOGY ENGINE

- **Task Package**: `TASKS-019`
- **Spec**: `SPEC-026-WASM-TOPOLOGY-GRAPH`
- **Plan**: `PLAN-019`
- **Status**: `READY_FOR_EXECUTION`

---

## Task DAG & Execution Sequence

```
[TASK-019-1: Go WASM Bridge & Compile]
               |
               v
[TASK-019-2: Core L0 TS Modules (eosWasmEngine.ts & eosFleetTopology.ts)]
               |
               v
[TASK-019-3: Test Suite test/eosWasmTopology.test.mjs]
               |
               v
[TASK-019-4: 3D Canvas Visualizer in index.html & js/eos.js]
               |
               v
[TASK-019-5: SRI Hashes, CI/CD Verification & Manifest Elevation]
```

### Task Definitions

1. **TASK-019-1: Go WASM Bridge & Compile**

   - Write `src/native/eos_wasm_bridge.go` utilizing `syscall/js`.
   - Copy `wasm_exec.js` to `js/wasm_exec.js`.
   - Compile `assets/eos_apex.wasm` with `GOOS=js GOARCH=wasm`.
   - Done criteria: `assets/eos_apex.wasm` exists and is a valid WebAssembly binary.

2. **TASK-019-2: Core L0 TS Modules**

   - Implement `src/core/eosWasmEngine.ts` and `src/core/eosFleetTopology.ts`.
   - Done criteria: 0 external dependencies, fully typed, pure functions.

3. **TASK-019-3: Test Suite**

   - Implement `test/eosWasmTopology.test.mjs` verifying graph topology, blast radius, token calculation, and fallback modes.
   - Done criteria: All tests pass with exit code 0.

4. **TASK-019-4: 3D Canvas Visualizer in Landing Page**

   - Embed Canvas `#eos-fleet-topology-canvas` and HUD in `index.html`.
   - Implement 3D rendering and mouse/touch drag rotation in `js/eos.js`.
   - Add responsive styles in `css/eos.css`.
   - Done criteria: 60-120 FPS rendering, zero layout shift.

5. **TASK-019-5: Verification & Production Seal**
   - Update `scripts/verify-cicd-pipeline.mjs` and run `scripts/verify-sri-integrity.mjs --fix`.
   - Execute `npm test` verifying all 7 stages pass.
   - Done criteria: 100% test pass, exit code 0.
