/**
 * EosMctsPolicyValueMesh (Layer 0 — Monte Carlo Tree Search Policy-Value Mesh)
 * Governed by SPEC-204, CHANGE-089, ADR-089, FR-1039..FR-1043, BDD-1039..BDD-1043 (v74.0.0)
 *
 * Implements:
 * - AlphaZero-inspired Monte Carlo Tree Search (MCTS) with PUCT (Polynomial Upper Confidence Trees).
 * - Dual policy-value evaluation: prior move probability distribution P(s, a) and state value V(s) in [-1, 1].
 * - 4-stage search: Selection -> Expansion -> Evaluation -> Backpropagation.
 * - Temperature-scaled action distribution: pi(a|s) proportional to N(s, a)^(1/tau).
 * - Causal trajectory rollouts and optimal planning paths.
 * - Tamper-evident SHA-256 decision attestation receipts.
 *
 * Strictly ZERO external runtime dependencies (Law V). Node 24 strip-only compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface MctsState {
  readonly id: string;
  readonly legalActions: readonly string[];
  readonly isTerminal: boolean;
  readonly reward?: number; // scalar in [-1.0, 1.0] when isTerminal is true
  readonly metadata?: Record<string, unknown>;
}

export interface MctsConfig {
  readonly cPuct?: number; // Exploration constant (default: 1.414)
  readonly simulations?: number; // Number of search rollouts (default: 100)
  readonly temperature?: number; // Selection temperature (default: 1.0, 0.0 for argmax)
  readonly maxDepth?: number; // Search horizon (default: 50)
}

export interface MctsNode {
  readonly id: string;
  readonly state: MctsState;
  readonly parent: MctsNode | null;
  readonly actionFromParent: string | null;
  readonly children: Map<string, MctsNode>;
  visitCount: number; // N(s, a)
  totalValue: number; // W(s, a)
  meanValue: number; // Q(s, a) = W / N
  priorProbability: number; // P(s, a)
  readonly depth: number;
}

export interface PolicyValueEvaluation {
  readonly priors: Record<string, number>;
  readonly value: number;
}

export interface MctsStep {
  readonly stepIndex: number;
  readonly stateId: string;
  readonly selectedAction: string;
  readonly visitCounts: Record<string, number>;
  readonly actionProbabilities: Record<string, number>;
  readonly expectedValue: number;
}

export interface MctsTrajectory {
  readonly steps: readonly MctsStep[];
  readonly finalStateId: string;
  readonly totalExpectedReward: number;
  readonly sha256Receipt: string;
}

export interface MctsSearchResult {
  readonly bestAction: string;
  readonly actionProbabilities: Record<string, number>;
  readonly expectedValue: number;
  readonly totalSimulations: number;
  readonly rootVisits: number;
  readonly trajectory: MctsTrajectory;
  readonly sha256Receipt: string;
}

export interface SerializedMctsTree {
  readonly version: string;
  readonly rootId: string;
  readonly nodeCount: number;
  readonly bestAction: string;
  readonly sha256Checksum: string;
}

export type StateTransitionFn = (state: MctsState, action: string) => MctsState;
export type CustomEvaluatorFn = (state: MctsState) => PolicyValueEvaluation;

export class EosMctsPolicyValueMesh {
  public readonly cPuct: number;
  public readonly simulations: number;
  public readonly temperature: number;
  public readonly maxDepth: number;

  constructor(config: MctsConfig = {}) {
    this.cPuct = config.cPuct ?? 1.414;
    this.simulations = config.simulations ?? 100;
    this.temperature = config.temperature ?? 1.0;
    this.maxDepth = config.maxDepth ?? 50;

    assertPrecondition(this.cPuct > 0, "cPuct must be positive");
    assertPrecondition(this.simulations >= 1, "simulations must be at least 1");
  }

  /**
   * Default built-in state evaluator: computes balanced priors and heuristic fitness.
   */
  public evaluateState(state: MctsState, customEvaluator?: CustomEvaluatorFn): PolicyValueEvaluation {
    if (customEvaluator) {
      return customEvaluator(state);
    }

    if (state.isTerminal) {
      return {
        priors: {},
        value: state.reward ?? 0.0,
      };
    }

    const legal = state.legalActions;
    if (legal.length === 0) {
      return { priors: {}, value: 0.0 };
    }

    // Assign uniform priors as baseline, with slight lexical determinism
    const priors: Record<string, number> = {};
    const uniformPrior = 1.0 / legal.length;
    for (const action of legal) {
      priors[action] = Number(uniformPrior.toFixed(4));
    }

    // Normalize priors to sum to exactly 1.0
    let sum = 0;
    for (const v of Object.values(priors)) sum += v;
    if (sum > 0) {
      for (const k of Object.keys(priors)) {
        priors[k] = priors[k]! / sum;
      }
    }

    // Default heuristic value derived from state properties
    const stateFitness = typeof state.metadata?.fitness === "number" ? state.metadata.fitness : 0.0;
    const value = Math.max(-1.0, Math.min(1.0, stateFitness));

    return { priors, value };
  }

  /**
   * Computes PUCT Upper Confidence Tree score for a child node.
   */
  public computePuct(child: MctsNode, totalParentVisits: number): number {
    const q = child.visitCount > 0 ? child.meanValue : 0.0;
    const u =
      this.cPuct * child.priorProbability * (Math.sqrt(Math.max(1, totalParentVisits)) / (1 + child.visitCount));
    return q + u;
  }

  /**
   * Selects child node maximizing PUCT score.
   */
  public selectChildPuct(node: MctsNode): { action: string; child: MctsNode } {
    assertPrecondition(node.children.size > 0, "selectChildPuct: node must have children");

    let bestAction = "";
    let bestChild: MctsNode | null = null;
    let bestScore = -Infinity;

    for (const [action, child] of node.children.entries()) {
      const score = this.computePuct(child, node.visitCount);
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
        bestChild = child;
      }
    }

    assertPostcondition(bestChild !== null, "selectChildPuct: child must be found");
    return { action: bestAction, child: bestChild! };
  }

  /**
   * Expands node by instantiating children for all legal actions.
   */
  public expandNode(node: MctsNode, transitionFn: StateTransitionFn, customEvaluator?: CustomEvaluatorFn): void {
    if (node.children.size > 0 || node.state.isTerminal) return;

    const evalResult = this.evaluateState(node.state, customEvaluator);

    for (const action of node.state.legalActions) {
      const nextState = transitionFn(node.state, action);
      const prior = evalResult.priors[action] ?? 1.0 / node.state.legalActions.length;

      const childNode: MctsNode = {
        id: `${node.id}->${action}`,
        state: nextState,
        parent: node,
        actionFromParent: action,
        children: new Map(),
        visitCount: 0,
        totalValue: 0,
        meanValue: 0,
        priorProbability: prior,
        depth: node.depth + 1,
      };

      node.children.set(action, childNode);
    }
  }

  /**
   * Backpropagates simulation value up to tree root.
   */
  public backpropagate(path: MctsNode[], value: number): void {
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i]!;
      node.visitCount++;
      node.totalValue += value;
      node.meanValue = node.totalValue / node.visitCount;
    }
  }

  /**
   * Executes MCTS search from initial state.
   */
  public search(
    initialState: MctsState,
    transitionFn: StateTransitionFn,
    simulations?: number,
    customEvaluator?: CustomEvaluatorFn,
  ): MctsSearchResult {
    assertPrecondition(Boolean(initialState && initialState.id), "search: valid initialState required");

    const simCount = simulations ?? this.simulations;

    const rootNode: MctsNode = {
      id: initialState.id,
      state: initialState,
      parent: null,
      actionFromParent: null,
      children: new Map(),
      visitCount: 0,
      totalValue: 0,
      meanValue: 0,
      priorProbability: 1.0,
      depth: 0,
    };

    // Initial expansion of root
    this.expandNode(rootNode, transitionFn, customEvaluator);

    for (let iter = 0; iter < simCount; iter++) {
      let current = rootNode;
      const path: MctsNode[] = [current];

      // Phase 1: Selection
      while (current.children.size > 0 && !current.state.isTerminal && current.depth < this.maxDepth) {
        const { child } = this.selectChildPuct(current);
        current = child;
        path.push(current);
      }

      // Phase 2: Expansion & Evaluation
      let leafValue = 0.0;
      if (current.state.isTerminal) {
        leafValue = current.state.reward ?? 0.0;
      } else {
        this.expandNode(current, transitionFn, customEvaluator);
        const evalRes = this.evaluateState(current.state, customEvaluator);
        leafValue = evalRes.value;
      }

      // Phase 3: Backpropagation
      this.backpropagate(path, leafValue);
    }

    const actionProbabilities = this.getActionDistribution(rootNode, this.temperature);
    const bestAction = this.selectBestAction(rootNode, 0.0); // Greedy best action
    const trajectory = this.extractBestTrajectory(rootNode, transitionFn, 10);

    const receiptPayload = `MCTS:${rootNode.id}:${bestAction}:${rootNode.visitCount}:${trajectory.totalExpectedReward}`;
    const sha256Receipt = pureSha256(receiptPayload);

    const result: MctsSearchResult = {
      bestAction,
      actionProbabilities,
      expectedValue: Number(rootNode.meanValue.toFixed(4)),
      totalSimulations: simCount,
      rootVisits: rootNode.visitCount,
      trajectory,
      sha256Receipt,
    };

    return deepFreeze(result);
  }

  /**
   * Computes normalized action probabilities from root visit counts with temperature.
   */
  public getActionDistribution(node: MctsNode, temperature: number = 1.0): Record<string, number> {
    const dist: Record<string, number> = {};
    if (node.children.size === 0) return dist;

    if (temperature <= 0.01) {
      // Deterministic argmax
      let maxVisits = -1;
      let argmaxAction = "";
      for (const [action, child] of node.children.entries()) {
        dist[action] = 0;
        if (child.visitCount > maxVisits) {
          maxVisits = child.visitCount;
          argmaxAction = action;
        }
      }
      if (argmaxAction) dist[argmaxAction] = 1.0;
      return dist;
    }

    let sum = 0;
    for (const [action, child] of node.children.entries()) {
      const scaled = Math.pow(Math.max(0, child.visitCount), 1.0 / temperature);
      dist[action] = scaled;
      sum += scaled;
    }

    if (sum > 0) {
      for (const action of Object.keys(dist)) {
        dist[action] = Number((dist[action]! / sum).toFixed(4));
      }
    }

    return dist;
  }

  /**
   * Selects best action based on visit counts.
   */
  public selectBestAction(node: MctsNode, temperature: number = 0.0): string {
    const dist = this.getActionDistribution(node, temperature);
    let bestAction = "";
    let maxProb = -1;

    for (const [action, prob] of Object.entries(dist)) {
      if (prob > maxProb) {
        maxProb = prob;
        bestAction = action;
      }
    }

    return bestAction || (node.state.legalActions[0] ?? "");
  }

  /**
   * Extracts optimal greedy rollout trajectory from root.
   */
  public extractBestTrajectory(
    rootNode: MctsNode,
    transitionFn: StateTransitionFn,
    maxSteps: number = 10,
  ): MctsTrajectory {
    const steps: MctsStep[] = [];
    let current = rootNode;
    let stepCount = 0;
    let totalReward = 0;

    while (current && !current.state.isTerminal && stepCount < maxSteps && current.children.size > 0) {
      const bestAction = this.selectBestAction(current, 0.0);
      const child = current.children.get(bestAction);

      const step: MctsStep = {
        stepIndex: stepCount + 1,
        stateId: current.state.id,
        selectedAction: bestAction,
        visitCounts: Object.fromEntries(Array.from(current.children.entries()).map(([a, c]) => [a, c.visitCount])),
        actionProbabilities: this.getActionDistribution(current, 1.0),
        expectedValue: child ? Number(child.meanValue.toFixed(4)) : 0,
      };

      steps.push(step);
      totalReward += step.expectedValue;
      stepCount++;

      if (child) {
        current = child;
      } else {
        const nextState = transitionFn(current.state, bestAction);
        current = {
          id: nextState.id,
          state: nextState,
          parent: current,
          actionFromParent: bestAction,
          children: new Map(),
          visitCount: 1,
          totalValue: 0,
          meanValue: 0,
          priorProbability: 1.0,
          depth: current.depth + 1,
        };
      }
    }

    const finalStateId = current ? current.state.id : rootNode.state.id;
    const sha256Receipt = pureSha256(`TRAJECTORY:${rootNode.id}:${steps.length}:${totalReward}`);

    return deepFreeze({
      steps,
      finalStateId,
      totalExpectedReward: Number(totalReward.toFixed(4)),
      sha256Receipt,
    });
  }

  /**
   * Serializes search tree summary for telemetry and audit.
   */
  public serializeTree(rootNode: MctsNode): SerializedMctsTree {
    let nodeCount = 0;
    const stack: MctsNode[] = [rootNode];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      nodeCount++;
      for (const child of curr.children.values()) {
        stack.push(child);
      }
    }

    const bestAction = this.selectBestAction(rootNode, 0.0);
    const sha256Checksum = pureSha256(`MCTS_TREE:${rootNode.id}:${nodeCount}:${bestAction}`);

    return deepFreeze({
      version: "MCTS_V74",
      rootId: rootNode.id,
      nodeCount,
      bestAction,
      sha256Checksum,
    });
  }
}
