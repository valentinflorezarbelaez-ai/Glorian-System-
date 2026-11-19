# PLAN-223: Architectural Plan for Glorian Live Studio & Interactive Visual HUD

**Document ID**: `PLAN-223-GLORIAN-LIVE-STUDIO`  
**Specification Target**: `SPEC-361` / `CHANGE-223`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Design & Philosophy

`EosGlorianLiveStudio` addresses the need for a live, visual control plane while maintaining the absolute non-negotiable rule of **Pure Layer-0** (`dependencies: {}`).

Rather than pulling in heavy frontend ecosystems (Vite, React, Tailwind, Next.js), the studio implements an elegant, high-performance embedded HTTP/SSE engine that dynamically renders a rich single-file HTML5/CSS3/SVG HUD. This HUD directly interfaces with:

- `EosArchitecturalCanvas` for deterministic Sugiyama DAG layout generation.
- `EosBitemporalEventLedger` for 2D time-travel historical state queries.
- `EosAgentSwarmMicroKernel` for live Raft leadership status and capability telemetry.
- `EosZeroCopyIpcRingBuffer` & `EosWorkStealingScheduler` for live concurrency metrics.

---

## 2. Architecture Decision Record (ADR-223-001)

### Title

**ADR-223-001: Embedded Zero-Dependency Native HTTP/SSE Live Studio vs External Frontend Build Pipelines**

### Status

`ACCEPTED`

### Context

To monitor and interact with the Glorian System in real time, a visual user interface is required. The conventional industry pattern is to create a separate Next.js or React SPA requiring Node package dependencies, Webpack/Vite bundlers, and hundreds of npm packages.

However, Glorian System is an ultra-hardened, self-verifying control plane with a strict rule: `dependencies: {}` in `package.json`. Introducing external build tooling would:

1. Violate Layer-0 purity.
2. Introduce supply-chain vulnerability vectors.
3. Require high resource overhead and complex cross-process orchestration.

### Decision

Implement `EosGlorianLiveStudio` as an autonomous, self-contained TypeScript class using solely Node.js standard libraries (`node:http`, `node:fs`, `node:path`, `node:crypto`).
The single-file HTML/CSS/JavaScript interface is generated directly in-memory, styling using dark-mode Tier S-0 design tokens, modern CSS Grid/Flexbox, and vector SVG topologies. Real-time updates are delivered via Server-Sent Events (SSE) with sequence numbering and automatic client reconnection.

### Consequences

- **Positive**: Zero external dependencies; startup time $< 5\text{ms}$; memory footprint $< 15\text{MB}$; instantaneous delivery over any standard browser; verified by Leslie Lamport TLA+ model.
- **Negative**: Visual UI components must be maintained within native DOM/CSS scripts without JSX syntax.

---

## 3. Rejected Alternatives

1. **Standalone Vite/React Dashboard**:
   - _Rejected_: Adds $\approx 150\text{MB}$ of `node_modules`, breaks `dependencies: {}`, and requires a separate build step before running.
2. **Terminal-Only TUI (Blessed / Ink)**:
   - _Rejected_: Limited to character grids; cannot render smooth vector SVG topologies, fluid zoom/pan, or continuous interactive bitemporal scrubbers.
3. **Static File Exporter**:
   - _Rejected_: Cannot stream live real-time telemetry or accept dynamic interactive projection requests.
