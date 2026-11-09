# PLAN-019: CLIENT-SIDE GO WEB-ASSEMBLY & 3D SOVEREIGN TOPOLOGY ENGINE

- **Plan ID**: `PLAN-019`
- **Related Spec**: `SPEC-026-WASM-TOPOLOGY-GRAPH`
- **Architect**: Valentín Flórez Arbeláez
- **Status**: `APPROVED`
- **Date**: 2026-10-25

---

## 1. Architecture Overview & High-Level Design

```
+------------------------------------------------------------------------+
|                      CLIENT-SIDE BROWSER RUNTIME                        |
|                                                                        |
|  +-----------------------------------+  +----------------------------+ |
|  |     3D Interactive Canvas HUD     |  |    Go WebAssembly Bridge   | |
|  |    (#eos-fleet-topology-canvas)   |  |   (assets/eos_apex.wasm)   | |
|  |                                   |  |   (js/wasm_exec.js)        | |
|  | - 14 Sovereign Topology Nodes     |  | - eosEstimateTokens()      | |
|  | - 3 Concentric Rings (R1, R2, R3) |  | - eosCompressContext()     | |
|  | - Orthographic 3D Projection      |  | - eosBenchmarkGo()         | |
|  | - Particle Pulse Ring Routing     |  | - eosAnalyzeTopology()     | |
|  | - Interactive Blast Radius Ring   |  +-------------+--------------+ |
|  +-----------------+-----------------+                |               |
|                    |                                  |               |
|                    v                                  v               |
|  +-------------------------------------------------------------------+ |
|  |                 Core Layer-0 TypeScript Fallback                  | |
|  |           (src/core/eosWasmEngine.ts & eosFleetTopology.ts)       | |
|  +-------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
```

## 2. ADR-033: Client-Side Go WebAssembly Engine & Zero-Dependency Canvas 3D Sovereign Topology Graph

### Context

Browser clients interacting with EOS System benefit from instant, deterministic computations without network round-trips. Running Go routines in the browser through WebAssembly brings Go's strict typing, AST parsing routines, and high-speed tokenization to the client. Simultaneously, a dynamic 3D visual graph communicates the entire sovereign architecture (Aberamentho, Portafolio, PTG, EOS System, Disruptor, DSP, Datomic, Healer) in real-time.

### Decision

1. **Compilation of Go to WASM**:
   - Utilize standard Go WebAssembly target (`GOOS=js GOARCH=wasm`) with `-ldflags="-s -w"` to build `assets/eos_apex.wasm`.
   - Vend the official Go runtime bridge `wasm_exec.js` directly in `js/wasm_exec.js` without any external npm packages.
2. **Deterministic Dual-Mode Execution**:
   - Provide `src/core/eosWasmEngine.ts` exposing high-level asynchronous APIs (`estimateTokens`, `compressContext`, `benchmarkGo`, `analyzeTopology`).
   - Automatically detect WebAssembly support. If WebAssembly is disabled, unsupported, or fails to stream, execute identical Layer-0 TypeScript heuristics.
3. **Pure Canvas 2D / 3D Mathematics**:
   - Render the 3D topology graph directly on an HTML5 `<canvas>` element using orthographic 3D projection formulas ($x' = x \cdot \cos\theta - z \cdot \sin\theta$, $y' = y$, $z' = x \cdot \sin\theta + z \cdot \cos\theta$).
   - Avoid heavy external dependencies (such as Three.js or Babylon.js), preserving Layer-0 zero-dependency compliance (`dependencies: {}`) and minimal bundle size.
   - Support mouse dragging for 3D rotation, auto-rotation drift, node hover hit-testing, and dynamic blast-radius highlighting with glowing particle pulse animation.

### Consequences

- **Positive**: 0-latency client-side token compression and Go benchmark execution; instant visual feedback of system topology; 100% compliant with Law V (0 external npm dependencies).
- **Negative / Trade-off**: The compiled `.wasm` file adds static asset weight (~1.8-2.2MB uncompressed, ~500KB gzipped), which must be loaded asynchronously or deferred so it never blocks First Contentful Paint (FCP) or Largest Contentful Paint (LCP).

---

_Approved by Principal Architect: Valentín Flórez Arbeláez_
