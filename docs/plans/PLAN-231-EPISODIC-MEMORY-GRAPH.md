# PLAN-231: Architecture Plan & ADR for Episodic Memory Graph & Cross-Project Experience Synapse

**Document ID**: `PLAN-231-EPISODIC-MEMORY-GRAPH`  
**Specification Target**: `SPEC-369` / `CHANGE-231`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Architectural Design & Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          EosEpisodicMemoryGraph              │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
          Ingest Episode │                                │ Query Associative
                         ▼                                ▼
       ┌───────────────────────────────┐   ┌───────────────────────────────┐
       │     EpisodicEpisodeStore      │   │    AssociativeSynapseEngine   │
       │ (Symptom, Root Cause, Fix,    │   │ (Cross-Repo Affinity Scoring, │
       │  Verification Receipt SHA)    │   │  Token/N-gram Projection)     │
       └───────────────┬───────────────┘   └───────────────▲───────────────┘
                       │                                   │
                       ▼                                   │ Synaptic Edges
       ┌───────────────────────────────────────────────────┴───────────────┐
       │             Directed Causal Graph & Pruning Engine                │
       │ (Temporal Ebbinghaus Decay, Recall Boost, Bounded Node Eviction)   │
       └───────────────────────────────────────────────────────────────────┘
```

## 2. ADR-231-001: Associative Cross-Project Episodic Memory Graph

### Context

When agents solve problems across 9 distributed repositories, knowledge learned in one repository (such as fixing a specific race condition or compiler error in Go, TypeScript, or Rust) is lost to agents working on other repositories. Standard vector databases introduce heavy external dependencies, API costs, network latency, and non-deterministic retrieval.

### Decision

Implement a pure Layer-0 in-memory directed episodic memory graph:

1. **Episodic Nodes**: Represent concrete past problem-solving instances with schema `(id, originRepo, errorSymptom, rootCause, solutionPatch, verificationReceipt, weight, timestamp)`.
2. **Associative Edge Construction**: Dynamic calculation of semantic and causal similarity between symptoms and solutions using deterministic Jaccard and n-gram overlap.
3. **Decay and Reinforcement**: Decay factor $W(t) = W_0 \cdot e^{-\lambda \Delta t}$, reinforced by $\Delta W = +0.25$ upon successful retrieval and application.
4. **Capacity Pruning**: Deterministic eviction of lowest-weighted nodes when capacity exceeds threshold while protecting pinned canonical nodes.

### Consequences

- **Positive**: Cross-repository knowledge reuse; sub-millisecond query time; zero external npm dependencies; verifiable cryptographic receipts.
- **Negative / Trade-offs**: In-memory graph capacity bounded by memory limit; token-based similarity is an approximation of high-dimensional embedding spaces.

## 3. Rejected Alternatives

- **External Vector DB (Pinecone, Chroma, Milvus)**: Rejected due to violation of Layer-0 pure zero-dependency commandment.
- **Flat File Log**: Rejected due to $O(N)$ linear scans and absence of causal relationship tracking.
