# CHANGE-220: Live Self-Introspecting Architectural Canvas & Bi-Directional Interactive Topology

**Change Proposal ID**: `CHANGE-220`  
**Target Specification**: `SPEC-358`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Lifecycle Tier**: `production`  
**Status**: `PROPOSED`  
**Author**: `user:valentin-florez-arbelaez` & `Antigravity Executive Orchestrator`  
**Date**: `2026-11-19`

---

## 1. Intent & Scope

### 1.1 Business Intent

Deliver a live, self-introspecting architectural canvas and bi-directional interactive topology engine that dynamically generates, visualizes, and mutates the complete topological architecture of Glorian System in real time. Incorporates Bret Victor's _Seeable Systems_ and Álvaro Moya's _LIDR Agentic Engineering Starter_ principles to eliminate context rot, architecture drift, and PR review rework across multi-agent swarms.

### 1.2 Technical Scope

1. **Types Module**: `src/core/eosArchitecturalCanvas.types.ts` defining `CanvasNode`, `CanvasEdge`, `CanvasLayer`, `CanvasLayoutGeometry`, `BlastRadiusReport`, `CanvasAuditReceipt`.
2. **Core Domain Module**: `src/core/eosArchitecturalCanvas.ts`:
   - `EosTopologyHarvester`: Scans filesystem and metadata to construct real-time dependency and invariant DAGs.
   - `EosCanvasLayoutEngine`: Pure Layer-0 Sugiyama layered graph layout with crossing minimization and coordinate assignment.
   - `EosInteractiveTopologyManager`: Bi-directional mutation, cycle prevention, invariant gatekeeper, and blast-radius graph traversal.
   - `EosCanvasSvgRenderer`: Pure SVG generation with theme tokens and interactive styling.
3. **Formal Specification**: OpenSpec `SPEC-358` with EARS `FR-358-01`..`FR-358-07` and BDD `BDD-1927`..`BDD-1932`.
4. **TLA+ Model 101**: `docs/formal/ArchitecturalCanvasTopology.tla` / `.cfg`.
5. **CLI & MCP Toolchain**:
   - `toolchain:canvas:audit`, `toolchain:canvas:graph`, `toolchain:canvas:render`, `toolchain:canvas:blast`.
   - MCP tool `eos_architectural_canvas_audit`.
6. **Automated Verification**: `test/eosArchitecturalCanvas.test.mjs`.
