# INTAKE-089: Monte Carlo Tree Search Policy-Value Mesh (SPEC-204)

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Owner)
- **Lifecycle Tier**: Core / Autonomous Heuristic Planning & Strategic Decision Mesh
- **Context**: DeepMind AlphaZero / Silver et al. (2017) MCTS Decision Optimization for Multi-Agent Planning

---

## 1. Problem Statement

Autonomous multi-agent architectures, cloud migration schedulers, and automated refactoring pipelines often face combinatorial state explosion when evaluating sequences of actions (e.g. dependency migration orders, chaos fault mitigation paths, or AST patch synthesis). Traditional greedy or branch-and-bound heuristics easily trap execution in local optima, while relying on external heavy deep learning inference servers (PyTorch, TensorFlow, vLLM) introduces non-hermetic network dependencies, unpredictable latency, and violates sovereign air-gapped guarantees (Law V: zero external runtime dependencies).

Glorian requires an in-memory, zero-dependency, Layer-0 **Monte Carlo Tree Search Policy-Value Mesh** (`EosMctsPolicyValueMesh`) that combines tree search with Upper Confidence Bounds for Trees (PUCT), prior policy evaluation, self-contained scalar value heuristics, temperature-scaled sampling, and tamper-evident decision receipts.

---

## 2. Requirements & Scope

1. **PUCT-Governed Tree Selection**:
   - Node selection balancing exploitation ($Q$) and exploration ($U$) via polynomial Upper Confidence Trees:
     $$U(s, a) = c_{\text{puct}} \cdot P(s, a) \cdot \frac{\sqrt{\sum_b N(s, b)}}{1 + N(s, a)}$$
2. **Prior Policy & State Value Heuristic**:
   - Zero-dependency heuristic network generating prior action distribution $P(s, a)$ and state value $V(s) \in [-1.0, 1.0]$.
3. **MCTS Search Lifecycle**:
   - 4-phase iteration: Selection -> Expansion -> Simulation / Evaluation -> Backpropagation.
   - Temperature parameter $\tau$ for action selection: $\pi(a|s) \propto N(s, a)^{1/\tau}$.
4. **Causal Trajectory Extraction**:
   - Output of optimal decision path, accumulated reward, visit distribution, and variance.
5. **Deterministic Serialization & Receipts**:
   - State and search tree export with SHA-256 cryptographic receipt certifying optimality and decision rationale.
6. **CLI & MCP Control Surfaces**:
   - CLI commands `glorian mcts:search` and `glorian mcts:play`.
   - MCP actions `mcts_search` and `mcts_evaluate`.
