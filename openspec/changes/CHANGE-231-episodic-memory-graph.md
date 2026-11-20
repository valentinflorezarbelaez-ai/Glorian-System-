# CHANGE-231: Episodic Memory Graph & Cross-Project Experience Synapse

**Change ID**: `CHANGE-231-episodic-memory-graph`  
**Specification Target**: `SPEC-369`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `PROPOSED`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Description

Introduces the Episodic Memory Graph & Cross-Project Experience Synapse to the Glorian System Control Plane. This provides an associative, graph-structured episodic memory repository enabling autonomous agents to record, index, and retrieve problem-solving episodes, bug patterns, and verified patch strategies across all 9 registered fleet repositories.

## 2. Delta Specification

- **Added Capabilities**:
  - `EosEpisodicMemoryGraph`: Directed causal memory graph capturing episodic nodes (symptom, root cause, fix, verification receipt) and synaptic edges.
  - `AssociativeSynapseEngine`: Cross-project semantic retrieval using token projection and topology-weighted similarity scoring.
  - `TemporalMemoryGovernor`: Applies Ebbinghaus forgetting curves, exponential decay, and reinforcement on successful recall.
  - CLI commands: `toolchain:memory:record`, `toolchain:memory:query`, `toolchain:memory:graph`, `toolchain:memory:audit`.
  - Phase 8 MCP tool: `eos_episodic_memory_graph_audit`.
  - TLA+ Model 112: `docs/formal/EpisodicMemoryGraph.tla`.

## 3. Impact Assessment

- Pure Layer-0 zero-dependency implementation.
- Zero breaking changes to existing subsystems.
- All code $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
