/**
 * EOS SYSTEM — MONTE CARLO TREE SEARCH POLICY-VALUE MESH TEST SUITE
 * Governed by SPEC-204, CHANGE-089, ADR-089, BDD-1039..BDD-1043 (v74.0.0)
 *
 * Validates PUCT tree selection, dual policy-value heuristic evaluations,
 * multi-rollout MCTS search convergence, temperature-scaled action distributions,
 * optimal trajectory extraction, tree serialization, and CLI execution.
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosMctsPolicyValueMesh } from "../src/core/eosMctsPolicyValueMesh.ts";

describe("EosMctsPolicyValueMesh (SPEC-204 / BDD-1039..BDD-1043)", () => {
  it("BDD-1039: PUCT tree node selection and exploration bonus", () => {
    const mcts = new EosMctsPolicyValueMesh({ cPuct: 1.5 });

    const parentNode = {
      id: "parent",
      state: { id: "s0", legalActions: ["a1", "a2"], isTerminal: false },
      parent: null,
      actionFromParent: null,
      children: new Map(),
      visitCount: 10,
      totalValue: 5.0,
      meanValue: 0.5,
      priorProbability: 1.0,
      depth: 0,
    };

    // Child 1: visited 8 times with mean value 0.6, prior 0.5
    const child1 = {
      id: "parent->a1",
      state: { id: "s1", legalActions: [], isTerminal: false },
      parent: parentNode,
      actionFromParent: "a1",
      children: new Map(),
      visitCount: 8,
      totalValue: 4.8,
      meanValue: 0.6,
      priorProbability: 0.5,
      depth: 1,
    };

    // Child 2: visited only 2 times with mean value 0.4, prior 0.5 (should get huge exploration bonus)
    const child2 = {
      id: "parent->a2",
      state: { id: "s2", legalActions: [], isTerminal: false },
      parent: parentNode,
      actionFromParent: "a2",
      children: new Map(),
      visitCount: 2,
      totalValue: 0.8,
      meanValue: 0.4,
      priorProbability: 0.5,
      depth: 1,
    };

    parentNode.children.set("a1", child1);
    parentNode.children.set("a2", child2);

    const puct1 = mcts.computePuct(child1, parentNode.visitCount);
    const puct2 = mcts.computePuct(child2, parentNode.visitCount);

    assert.ok(typeof puct1 === "number" && typeof puct2 === "number");
    assert.ok(puct1 > 0 && puct2 > 0);

    const selection = mcts.selectChildPuct(parentNode);
    assert.ok(["a1", "a2"].includes(selection.action));
    assert.ok(selection.child === child1 || selection.child === child2);
  });

  it("BDD-1040: Dual policy-value evaluation and prior normalization", () => {
    const mcts = new EosMctsPolicyValueMesh();

    const state = {
      id: "state_decision_point",
      legalActions: ["action_north", "action_south", "action_east", "action_west"],
      isTerminal: false,
      metadata: { fitness: 0.75 },
    };

    const evaluation = mcts.evaluateState(state);

    // 1. Priors must sum to 1.0
    const priorValues = Object.values(evaluation.priors);
    assert.equal(priorValues.length, 4);
    const sumPriors = priorValues.reduce((acc, v) => acc + v, 0);
    assert.ok(Math.abs(sumPriors - 1.0) < 1e-4);

    // 2. Value must be within [-1.0, 1.0]
    assert.ok(evaluation.value >= -1.0 && evaluation.value <= 1.0);
    assert.equal(evaluation.value, 0.75);

    // Terminal state evaluation
    const terminalState = {
      id: "terminal_state",
      legalActions: [],
      isTerminal: true,
      reward: 1.0,
    };
    const terminalEval = mcts.evaluateState(terminalState);
    assert.equal(terminalEval.value, 1.0);
    assert.deepEqual(terminalEval.priors, {});
  });

  it("BDD-1041: Multi-iteration MCTS search convergence and backpropagation", () => {
    const mcts = new EosMctsPolicyValueMesh({
      simulations: 60,
      cPuct: 1.414,
      temperature: 0.0,
    });

    const initialState = {
      id: "root_task",
      legalActions: ["suboptimal_path", "optimal_path"],
      isTerminal: false,
      metadata: { step: 0 },
    };

    const transitionFn = (state, action) => {
      const step = (state.metadata?.step ?? 0) + 1;
      const isTerminal = step >= 2;
      const isOptimal = action === "optimal_path" || state.id.includes("optimal_path");
      const reward = isOptimal ? 0.95 : 0.1;

      return {
        id: `${state.id}->${action}`,
        legalActions: isTerminal ? [] : ["finalize"],
        isTerminal,
        reward: isTerminal ? reward : undefined,
        metadata: { step, fitness: reward },
      };
    };

    const searchResult = mcts.search(initialState, transitionFn, 60);

    assert.equal(searchResult.bestAction, "optimal_path");
    assert.equal(searchResult.totalSimulations, 60);
    assert.ok(searchResult.rootVisits >= 60);
    assert.ok(searchResult.expectedValue > 0.5);
    assert.equal(searchResult.sha256Receipt.length, 64);
  });

  it("BDD-1042: Temperature-scaled action distribution and trajectory extraction", () => {
    const mcts = new EosMctsPolicyValueMesh();

    const rootNode = {
      id: "root_temp",
      state: { id: "s0", legalActions: ["opt_a", "opt_b"], isTerminal: false },
      parent: null,
      actionFromParent: null,
      children: new Map(),
      visitCount: 100,
      totalValue: 50,
      meanValue: 0.5,
      priorProbability: 1.0,
      depth: 0,
    };

    const childA = {
      id: "root_temp->opt_a",
      state: { id: "s1", legalActions: [], isTerminal: true, reward: 0.8 },
      parent: rootNode,
      actionFromParent: "opt_a",
      children: new Map(),
      visitCount: 90,
      totalValue: 72,
      meanValue: 0.8,
      priorProbability: 0.5,
      depth: 1,
    };

    const childB = {
      id: "root_temp->opt_b",
      state: { id: "s2", legalActions: [], isTerminal: true, reward: 0.2 },
      parent: rootNode,
      actionFromParent: "opt_b",
      children: new Map(),
      visitCount: 10,
      totalValue: 2,
      meanValue: 0.2,
      priorProbability: 0.5,
      depth: 1,
    };

    rootNode.children.set("opt_a", childA);
    rootNode.children.set("opt_b", childB);

    // 1. Argmax temperature (tau = 0.0)
    const distZero = mcts.getActionDistribution(rootNode, 0.0);
    assert.equal(distZero.opt_a, 1.0);
    assert.equal(distZero.opt_b, 0.0);

    // 2. High exploration temperature (tau = 2.0)
    const distWarm = mcts.getActionDistribution(rootNode, 2.0);
    assert.ok(distWarm.opt_a > distWarm.opt_b);
    assert.ok(distWarm.opt_b > 0.1);

    // 3. Trajectory extraction
    const trajectory = mcts.extractBestTrajectory(rootNode, (s, a) => ({
      ...s,
      id: `${s.id}->${a}`,
      isTerminal: true,
    }));
    assert.equal(trajectory.steps.length, 1);
    assert.equal(trajectory.steps[0].selectedAction, "opt_a");
    assert.equal(trajectory.sha256Receipt.length, 64);

    // 4. Tree serialization
    const serializedTree = mcts.serializeTree(rootNode);
    assert.equal(serializedTree.version, "MCTS_V74");
    assert.equal(serializedTree.nodeCount, 3);
    assert.equal(serializedTree.bestAction, "opt_a");
    assert.equal(serializedTree.sha256Checksum.length, 64);
  });

  it("BDD-1043: End-to-end CLI decision planning and SHA-256 attestation", () => {
    const cliOutput = execFileSync(
      "node",
      ["bin/eos.mjs", "mcts:search", "canary_migration", "--simulations=40", "--temp=0.0", "--json"],
      { encoding: "utf8" },
    );

    const parsed = JSON.parse(cliOutput);
    assert.ok(parsed.bestAction && parsed.bestAction.length > 0);
    assert.equal(parsed.totalSimulations, 40);
    assert.ok(parsed.trajectory.steps.length > 0);
    assert.equal(parsed.sha256Receipt.length, 64);
  });
});
