# PLAN-220: Architectural Implementation Plan for Live Self-Introspecting Canvas & Bi-Directional Topology

**Plan ID**: `PLAN-220-ARCHITECTURAL-CANVAS-TOPOLOGY`  
**Specification**: `SPEC-358`  
**Change Proposal**: `CHANGE-220`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`

---

## 1. Architectural Decisions (ADR)

### ADR-220-001: Pure Layer-0 Sugiyama Layout vs External NPM Graph Engines

- **Context**: Visualizing and positioning complex dependency graphs typically relies on heavy npm packages (D3-hierarchy, Dagre, Graphlib, Cytoscape) or browser DOM APIs.
- **Decision**: Implement a pure Layer-0 hierarchical DAG layout algorithm directly in TypeScript (`EosCanvasLayoutEngine`). Employs Sugiyama's 3-phase methodology:
  1. _Layer Assignment (Rank)_: Longest-path / topological sorting assigns each node to a horizontal/vertical discrete layer.
  2. _Crossing Minimization_: Barycenter heuristic iteratively sorts vertices in adjacent layers to minimize edge crossings.
  3. _Coordinate Assignment_: Assigns bounded integer coordinates (x, y) with spacing and bounding box margins.
- **Consequences**: Zero runtime dependencies (`dependencies: {}`), instant deterministic computation (< 10ms for 1,000 nodes), fully runnable on headless Node.js, CLI, and MCP servers.

### ADR-220-002: Bi-Directional Interactive Mutation & Real-Time Blast Radius

- **Context**: When agents modify code or specs, they need to know if the proposed link introduces cycles or breaches architectural layers (Hexagonal core purity).
- **Decision**: Implement `EosInteractiveTopologyManager` with depth-first search (DFS) 3-color cycle detection (`WHITE`, `GRAY`, `BLACK`) on every edge addition. Simultaneously computes bidirectional transitive reachability to calculate the exact blast radius:
  - _Upstream_: What components depend on this node? (Breakage risk)
  - _Downstream_: What components does this node depend on? (Coupling risk)
- **Consequences**: Guarantees DAG acyclicity at all times and provides autonomous agents with instantaneous feedback before committing changes, directly realizing Álvaro Moya's LIDR principles of 0 PR rework.

---

## 2. Module Architecture

```
src/core/
├── eosArchitecturalCanvas.types.ts  # Types: CanvasNode, CanvasEdge, Topology, BlastRadius, Geometry
├── eosArchitecturalCanvas.ts        # Harvester, Sugiyama Layout, TopologyManager, SvgRenderer, Core
bin/commands/
├── cliArchitecturalCanvas.mjs       # CLI: toolchain:canvas:audit, graph, render, blast
test/
├── eosArchitecturalCanvas.test.mjs  # BDD-1927..1932 Verification
docs/formal/
├── ArchitecturalCanvasTopology.tla  # Leslie Lamport TLA+ Model 101
└── ArchitecturalCanvasTopology.cfg  # Model configuration
```
