# INTAKE-151: Relational Closure on the Repository Knowledge Graph

- **Intake ID**: `INTAKE-151`
- **Project**: `eos-system`
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-04
- **Parent**: `SPEC-145`

## Problem

SPEC-145 already stores directed architectural edges in SQLite WAL and computes blast radius with a recursive CTE. A separate in-memory graph, `EosOntologyCyclotron`, can walk predicates, but it is not loaded from that database. Specifications do not yet emit `INSTRUMENTS` edges to declared MCP tools, and modules or specifications do not yet emit `COVERED_BY` edges to the test suites that name them. A blast-radius query for an unknown identifier returns an empty subgraph.

## Requested outcome

After `syncGraph()`, the same node and edge set is projected into the in-memory cyclotron. Queries for an unknown node fail closed. Closure duration is reported in microseconds. This intake does not request multi-host consensus or hot Rust-to-WebAssembly compilation.

## Constraints

- Layer-0 only. `package.json` keeps zero runtime dependencies.
- Existing SPEC-145 relations and the sub-5ms CTE budget remain in force.
- Published memory-closure budget for this change: at most 1000 microseconds after one warmup, for a reachable set of at most 64 nodes.
