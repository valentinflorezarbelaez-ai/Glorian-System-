/**
 * @file eosCausalMetaLearning.test.mjs
 * @description Automated test suite for SPEC-353 / CHANGE-215: Autonomous Causal Meta-Learning & Counterfactual Policy Engine.
 *
 * Verifies BDD-1897 through BDD-1902:
 * - BDD-1897: Structural Causal Model DAG Validation & Deterministic Topological Sort
 * - BDD-1898: Pearl's Do-Calculus Graph Surgery & Parent Edge Mutilation
 * - BDD-1899: Backdoor Criterion Evaluation & Confounding Adjustment Set Identification
 * - BDD-1900: Three-Step Algorithmic Counterfactual Evaluation (Abduction -> Action -> Prediction)
 * - BDD-1901: Invariant Causal Policy Distillation & Average Treatment Effect (ATE)
 * - BDD-1902: Leslie Lamport TLA+ Model 96 Model-Checking Verification Invariant
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosStructuralCausalModel,
  EosDoCalculusEngine,
  EosCounterfactualReasoner,
  EosCausalMetaLearningCore,
} from "../src/core/eosCausalMetaLearning.ts";

test("BDD-1897: Structural Causal Model DAG Validation & Deterministic Topological Sort", () => {
  const scm = EosCausalMetaLearningCore.generateReferenceModel();

  assert.equal(scm.name, "GlorianAgentCausalGovernorModel");
  assert.equal(scm.getNodes().length, 4);
  assert.equal(scm.getEdges().length, 4);

  const order = scm.getTopologicalOrder();
  assert.deepEqual(order, ["W_workload", "X_policy", "M_queue", "Y_latency"]);

  // Test cycle detection
  assert.throws(
    () => {
      new EosStructuralCausalModel({
        name: "CyclicModel",
        nodes: [
          { id: "A", name: "Node A", type: "CONTINUOUS", exogenousParentId: "U_A" },
          { id: "B", name: "Node B", type: "CONTINUOUS", exogenousParentId: "U_B" },
        ],
        edges: [
          { from: "A", to: "B" },
          { from: "B", to: "A" },
        ],
        equations: {
          A: { targetNodeId: "A", parentIds: ["B"], formula: (p, n) => p.B + n, noiseInverter: (v, p) => v - p.B },
          B: { targetNodeId: "B", parentIds: ["A"], formula: (p, n) => p.A + n, noiseInverter: (v, p) => v - p.A },
        },
      });
    },
    {
      message: /CYCLIC_CAUSAL_DEPENDENCY_DETECTED/,
    },
  );
});

test("BDD-1898: Pearl's Do-Calculus Graph Surgery & Parent Edge Mutilation", () => {
  const scm = EosCausalMetaLearningCore.generateReferenceModel();

  // Initially X_policy has incoming edge from W_workload
  assert.equal(scm.getEdges().length, 4);
  assert.deepEqual(scm.getParents("X_policy"), ["W_workload"]);

  // Apply atomic intervention: do(X_policy = 1)
  const mutilated = EosDoCalculusEngine.applyIntervention(scm, { X_policy: 1 });

  // Incoming parent edge (W_workload -> X_policy) must be severed
  assert.equal(mutilated.severedEdges.length, 1);
  assert.equal(mutilated.severedEdges[0].from, "W_workload");
  assert.equal(mutilated.severedEdges[0].to, "X_policy");

  // Mutilated SCM G_X_bar has 3 edges remaining
  const mutilatedScm = mutilated.mutilatedScm;
  assert.equal(mutilatedScm.getEdges().length, 3);
  assert.deepEqual(mutilatedScm.getParents("X_policy"), []);

  // Other equations remain invariant
  assert.ok(mutilatedScm.getEquation("Y_latency"));
  assert.ok(mutilatedScm.getEquation("M_queue"));
});

test("BDD-1899: Backdoor Criterion Evaluation & Confounding Adjustment Set Identification", () => {
  const scm = EosCausalMetaLearningCore.generateReferenceModel();

  // Test admissible adjustment set: Z = { W_workload }
  const validAdjustment = EosDoCalculusEngine.evaluateBackdoorCriterion(scm, "X_policy", "Y_latency", ["W_workload"]);
  assert.equal(validAdjustment.isAdmissible, true);
  assert.equal(validAdjustment.violations.length, 0);

  // Test inadmissible adjustment set containing descendant of X: Z = { M_queue }
  const invalidAdjustment = EosDoCalculusEngine.evaluateBackdoorCriterion(scm, "X_policy", "Y_latency", ["M_queue"]);
  assert.equal(invalidAdjustment.isAdmissible, false);
  assert.ok(invalidAdjustment.violations.some((v) => v.includes("DESCENDANT_IN_ADJUSTMENT_SET")));

  // Test empty adjustment set: Z = {} fails because backdoor path through W_workload remains unblocked
  const emptyAdjustment = EosDoCalculusEngine.evaluateBackdoorCriterion(scm, "X_policy", "Y_latency", []);
  assert.equal(emptyAdjustment.isAdmissible, false);
  assert.ok(emptyAdjustment.violations.some((v) => v.includes("UNBLOCKED_BACKDOOR_PATH")));
});

test("BDD-1900: Three-Step Algorithmic Counterfactual Evaluation (Abduction -> Action -> Prediction)", () => {
  const scm = EosCausalMetaLearningCore.generateReferenceModel();

  // Factual observation:
  // Under high workload W=60 and policy X=1: M = 1*15 + 2 = 17, Y = 60*2 + 17*1.5 + 9.5 = 155
  const query = {
    observedEvidence: {
      W_workload: 60,
      X_policy: 1,
      M_queue: 17,
      Y_latency: 155,
    },
    intervention: { X_policy: 0 },
    targetVariable: "Y_latency",
  };

  const cf = EosCounterfactualReasoner.evaluateCounterfactual(scm, query);

  // 1. Abduction verification: noise values deduced exactly
  assert.equal(cf.abductedNoise.U_workload, 60);
  assert.equal(cf.abductedNoise.U_queue, 2); // 17 - 15 = 2

  // 2. Action & Prediction verification:
  // Had X been 0, M_cf = 0*15 + 2 = 2, Y_cf = 60*2 + 2*1.5 + U_latency = 120 + 3 + 9.5 = 132.5
  assert.equal(cf.factualValue, 155);
  assert.equal(cf.counterfactualValue, 132.5);

  // Individual Treatment Effect (ITE) = 132.5 - 155 = -22.5 ms latency reduction
  assert.equal(cf.individualTreatmentEffect, -22.5);
});

test("BDD-1901: Invariant Causal Policy Distillation & Average Treatment Effect (ATE)", () => {
  const scm = EosCausalMetaLearningCore.generateReferenceModel();

  const ateResult = EosCausalMetaLearningCore.computeAverageTreatmentEffect(
    scm,
    "X_policy",
    "Y_latency",
    0, // control: X = 0
    1, // treated: X = 1
    [
      { W_workload: 20, U_queue: 2, U_latency: 5 },
      { W_workload: 50, U_queue: 1, U_latency: 4 },
      { W_workload: 80, U_queue: 3, U_latency: 6 },
    ],
  );

  // Switching policy X from 0 to 1 adds 15 to queue, which adds 15 * 1.5 = 22.5 to latency
  assert.equal(ateResult.treatment, "X_policy");
  assert.equal(ateResult.outcome, "Y_latency");
  assert.equal(ateResult.averageTreatmentEffect, 22.5);
  assert.equal(ateResult.isCausallySignificant, true);
});

test("BDD-1902: Leslie Lamport TLA+ Model 96 Model-Checking Verification Invariant", () => {
  const receipt = EosCausalMetaLearningCore.audit(process.cwd());

  assert.equal(receipt.status, "HEALTHY");
  assert.equal(receipt.specId, "SPEC-353");
  assert.equal(receipt.changeId, "CHANGE-215");
  assert.equal(receipt.scmNodesCount, 4);
  assert.equal(receipt.scmEdgesCount, 4);
  assert.equal(receipt.backdoorVerified, true);
  assert.equal(receipt.counterfactualVerified, true);
  assert.equal(receipt.ateVerified, true);
  assert.equal(receipt.tlcModelPass, true);
  assert.ok(typeof receipt.sha256Receipt === "string" && receipt.sha256Receipt.length === 64);

  const receiptPath = resolveEvidencePath("CAUSAL_META_LEARNING_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
  const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(saved.status, "HEALTHY");
  assert.equal(saved.specId, "SPEC-353");
});
