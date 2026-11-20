# INTAKE-231: Episodic Memory Graph & Cross-Project Experience Synapse

**Document ID**: `INTAKE-231-EPISODIC-MEMORY-GRAPH`  
**Specification Target**: `SPEC-369` / `CHANGE-231`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Lifecycle Tier**: `production`  
**Date**: `2026-11-19`  
**Status**: `INTAKE_COMPLETE`

---

## 1. Problem Statement & Motivation

In autonomous multi-agent engineering across multi-repository fleets (9 registered fleet repositories in Glorian), agents frequently solve identical bugs, compiler issues, architectural migrations, and runtime misconfigurations repeatedly in silos without cross-project associative transfer.

State-of-the-art Big Tech agent architectures (Google DeepMind, MemGPT, Engram, Anthropic Reflexion, and LIDR Agentic Engineering frameworks) achieve superhuman problem-solving speed by maintaining an **Episodic Memory Graph & Cross-Project Experience Synapse**:

1. **Episodic Causal Trace Graph**: Records episodes comprising Context, Failure Pattern, Exploration Graph, Solution Delta, and Verification Evidence.
2. **Associative Cross-Project Synapse**: Maps abstract problem representations across fleet repositories using graph traversal and n-gram similarity.
3. **Temporal Ebbinghaus Decay & Reinforcement**: Weights memory nodes dynamically based on successful recall, recency, and verification fidelity.

## 2. Business & Engineering Objectives

- **O1: Episodic Episode Storage**: Capture immutable structured episodes linking failure symptoms, root causes, and verified fixes.
- **O2: Associative Synaptic Retrieval**: Perform sub-millisecond retrieval of relevant historical episodes across all 9 fleet repositories without external vector databases.
- **O3: Causal Failure Graph Traversal**: Trace causal dependencies between code symbols, past bugs, and successful remediation strategies.
- **O4: Layer-0 Deterministic Verification**: Zero third-party npm dependencies, TLA+ verified graph consistency, and verifiable cryptographic receipts.

## 3. Scope & Boundary

- **In-Scope**:
  - Episodic trace schemas, graph node and edge management, temporal decay functions.
  - Cross-project associative search and causal traversal.
  - Leslie Lamport TLA+ Model 112 formal verification.
  - Phase 8 MCP Tool `eos_episodic_memory_graph_audit`.
  - CLI `toolchain:memory:*` command family.
- **Out-of-Scope**:
  - Storing confidential user passwords or unencrypted API credentials in episode payloads.
