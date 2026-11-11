# PLAN-089: Monte Carlo Tree Search Policy-Value Mesh (SPEC-204)

## Architectural Approach

1. **State & Action Model**:
   - `MctsState`: generic interface representing planning state (e.g. key, steps, legalActions, isTerminal, reward).
   - Domain implementations:
     - Optimization problem: task scheduling, refactoring dependency ordering, or grid pathfinding with obstacles.

2. **Node Representation & PUCT Selection**:
   - `MctsNode`:
     - `state`: current state
     - `parent`: parent node reference
     - `actionFromParent`: action taken to reach node
     - `children`: `Map<string, MctsNode>`
     - `visitCount (N)`: number of visits
     - `totalValue (W)`: cumulative backpropagated value
     - `meanValue (Q = W / N)`
     - `priorProbability (P)`
   - Formula:
     $$\text{score}(a) = Q(s, a) + c_{\text{puct}} \cdot P(s, a) \cdot \frac{\sqrt{\sum_b N(s, b) + \epsilon}}{1 + N(s, a)}$$

3. **Dual Head Policy-Value Heuristic**:
   - `evaluateState(state)`:
     - Softmax normalized prior probabilities $P(s, a)$ over legal actions.
     - Scalar value $V(s) \in [-1.0, 1.0]$ based on state fitness / distance to goal.

4. **Rollout, Backpropagation & Trajectory Extraction**:
   - Loop $N$ times:
     - Traverse children selecting $\arg\max (Q + U)$ until an unexpanded node or terminal state is reached.
     - Expand valid children.
     - Evaluate value $V$ using dual head or terminal reward.
     - Backpropagate $V$ up to root: increment $N$, add $V$ to $W$, update $Q = W/N$.
   - Extract trajectory: trace greedy $\arg\max N$ from root until terminal state or maxSteps.

5. **Integrations**:
   - Subpath export `"./mcts"` in `package.json` and export in `src/core/index.ts`.
   - CLI commands `mcts:search` and `mcts:play` in `bin/commands/cliPlatform.mjs` & help in `bin/commands/cliKernel.mjs`.
   - MCP actions `mcts_search` and `mcts_evaluate` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
   - Test suite `test/eosMctsPolicyValueMesh.test.mjs` (BDD-1039..BDD-1043).
   - Facade test step 16 in `test/eosEnterpriseFacade.test.mjs`.
