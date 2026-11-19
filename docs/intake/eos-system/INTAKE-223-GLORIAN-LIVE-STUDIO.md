# INTAKE-223: Glorian Live Studio & Interactive Visual HUD (Zero-Dependency Embedded Real-Time Control Plane)

**Document ID**: `INTAKE-223-GLORIAN-LIVE-STUDIO`  
**Target Specification**: `SPEC-361` / `CHANGE-223`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Lifecycle Tier**: `production`  
**Target Delivery Date**: 2026-11-19  
**Status**: `INTAKE_COMPLETE`  
**Level Authorization Required**: `LEVEL_3_PRODUCTION_AUTHORIZED`

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Blind Cockpit Problem in Autonomous Systems

As Glorian System scales across 360 OpenSpecs, 103 formal TLA+ models, 594 TypeScript modules, and 9 fleet repositories, developers and operators face the **Cognitive Blind Cockpit Problem**:

1. **Terminal Saturation**: Operators are forced to run dozens of disparate CLI commands (`toolchain:canvas:render`, `toolchain:kernel:status`, `toolchain:ledger:asof`, `fleet:status`) across multiple terminal windows, piecing together system state through text dumps.
2. **Invisible Dynamic Topology**: The dynamic interactions between Raft-elected agent micro-kernels, work-stealing scheduler ring buffers, and bitemporal transaction histories remain largely invisible during runtime execution.
3. **Heavy External GUI Bloat**: Traditional monitoring tools (Grafana, Backstage, Webpack-based dashboards) introduce massive dependency trees (React, Next.js, Electron, node_modules bloat exceeding 300MB), violating the Supreme Invariant of Capa 0 Pura (`dependencies: {}`).
4. **Lack of Bret Victor "Seeable Systems" Interactivity**: System comprehension requires immediate, tangible feedback—the ability to scrub through bitemporal time, click any node to instantly reveal its transitive blast radius, and view live SSE telemetry pulses without page refreshes.

---

## 2. Strategic Objectives & Architectural Requirements

1. **Zero-Dependency Native HTTP/SSE Server**:
   Implement an embedded HTTP server using only Node.js core libraries (`node:http`, `node:fs`, `node:path`, `node:crypto`). Zero runtime npm dependencies.
2. **Self-Contained Reactive Single-File HUD**:
   Serve an ultra-responsive, accessible (WCAG 2.1 AA) single-page visual HUD embedded directly within the TypeScript engine. Provides dark-mode design tokens (Tier S-0), responsive SVG canvas rendering, live metric gauges, and modal inspectors.
3. **Real-Time Telemetry Streaming (SSE)**:
   Provide a persistent Server-Sent Events stream (`/api/stream` or `/events`) pushing scheduler telemetry, Raft swarm leadership state, bitemporal datom commits, and live audit pulses with backpressure handling.
4. **Interactive 2D Bitemporal Time-Travel Slider**:
   Enable dual scrubbing across Transaction Time (`txTimestamp`) and Valid Time (`validTimestamp`), allowing users to visually inspect past, present, and counterfactual system architectures.
5. **Interactive Blast-Radius & Dependency Inspector**:
   Enable dynamic selection of any module or specification in the topological graph, calculating and highlighting upstream ancestors, downstream dependents, and transitive blast radius in < 5ms.
6. **Programmatic Headless API & CLI Integration**:
   Provide `/api/snapshot`, `/api/health`, and `/api/topology` endpoints, with CLI commands (`toolchain:studio:start`, `toolchain:studio:snapshot`, `toolchain:studio:audit`) and Phase 8 MCP tool `eos_glorian_live_studio_audit`.

---

## 3. Formal Quality Invariants & Verification Criteria

- **Inviolable Layer-0 Purity**: `dependencies: {}` in `package.json` must remain strictly untouched.
- **Max Line Limit**: All files must strictly respect $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
- **Leslie Lamport Formal Model**: Author TLA+ Model 104 (`docs/formal/GlorianLiveStudio.tla` / `.cfg`) proving client connection lifecycle, SSE event sequence monotonicity, and non-blocking shutdown safety.
- **BDD Conformance**: 6 formal scenarios (`BDD-1945` through `BDD-1950`) verified with 100% pass rate.
