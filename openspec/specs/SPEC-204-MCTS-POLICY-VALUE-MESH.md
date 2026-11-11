# SPEC-204: Monte Carlo Tree Search Policy-Value Mesh

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Autonomous Heuristic Planning & Strategic Decision Mesh
- **Standard**: DeepMind AlphaZero / Silver et al. (2017) / IEEE Transactions on Computational Intelligence
- **Module**: `src/core/eosMctsPolicyValueMesh.ts`

---

## 1. Context and Rationale

Autonomous multi-agent architectures, cloud migration schedulers, and automated refactoring pipelines face combinatorial state explosion when evaluating sequences of actions. Traditional greedy heuristics trap execution in local optima, while relying on external heavy deep learning inference servers (PyTorch, TensorFlow, vLLM) introduces non-hermetic network dependencies and unpredictable latency (violating Law V: zero external runtime dependencies).

`EosMctsPolicyValueMesh` provides an in-memory, zero-dependency Monte Carlo Tree Search (MCTS) engine combining Upper Confidence Bounds for Trees (PUCT), prior policy evaluation, self-contained scalar value heuristics, temperature-scaled action sampling, and tamper-evident decision receipts.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1039 (Ubiquitous - PUCT Tree Selection)**: `THE SYSTEM SHALL evaluate tree node choices using polynomial Upper Confidence Trees (PUCT) balancing mean action-value Q with exploration bonus U.`

- **FR-1040 (Ubiquitous - Dual Policy-Value Evaluation Head)**: `THE SYSTEM SHALL compute prior move probabilities P(s, a) and expected scalar state value V(s) in [-1.0, 1.0] without external ML frameworks.`

- **FR-1041 (Event-Driven - Iterative Rollout & Backpropagation)**: `THE SYSTEM SHALL perform N Monte Carlo simulations updating visit counts N(s, a) and total action value W(s, a) along the traversed path.`

- **FR-1042 (Ubiquitous - Temperature-Governed Action Selection)**: `THE SYSTEM SHALL compute visit distribution probabilities pi(a|s) parameterized by temperature tau, selecting optimal action at tau -> 0.`

- **FR-1043 (Ubiquitous - Cryptographic Decision Attestation)**: `THE SYSTEM SHALL output the optimal rollout trajectory and emit a SHA-256 decision receipt certifying state, priors, and visit counts.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1039 PUCT tree node selection and exploration bonus
  GIVEN an MCTS node with child action statistics
  WHEN the PUCT selection formula is evaluated with exploration constant c_puct
  THEN children with higher prior P or fewer visits N receive elevated exploration bonuses
  AND the action maximizing Q + U is deterministically selected.

SCENARIO: BDD-1040 Dual policy-value evaluation and prior normalization
  GIVEN an arbitrary domain state representation
  WHEN the policy-value evaluator is invoked
  THEN prior probabilities sum to exactly 1.0 across all legal moves
  AND the estimated scalar state value falls strictly within [-1.0, 1.0].

SCENARIO: BDD-1041 Multi-iteration MCTS search convergence and backpropagation
  GIVEN a root state requiring multi-step decision planning
  WHEN search is executed for N simulations
  THEN visit counts and action values propagate backward through the root
  AND the search tree converges on the globally optimal action.

SCENARIO: BDD-1042 Temperature-scaled action distribution and trajectory extraction
  GIVEN a completed MCTS search tree
  WHEN action selection is evaluated under temperature tau
  THEN tau = 0 yields the greedy argmax action with highest visit count
  AND tau > 0 yields a valid stochastic probability distribution over actions.

SCENARIO: BDD-1043 End-to-end CLI decision planning and SHA-256 attestation
  GIVEN a planning query passed to glorian mcts:search
  WHEN the CLI executes MCTS planning
  THEN the system outputs the recommended action, trajectory, visit counts,
  AND emits an immutable SHA-256 decision attestation receipt.
```

---

## 4. Architectural Boundaries and Invariants

1. **Law V Compliance**: Strictly zero external runtime dependencies (`"dependencies": {}`).
2. **Computational Bound**: Simulation count $N$ bounded ($1 \le N \le 10000$), constant memory node allocation.
3. **Immutability & DbC**: Trajectories and search receipts sealed with `deepFreeze`, guarded by preconditions and postconditions.
