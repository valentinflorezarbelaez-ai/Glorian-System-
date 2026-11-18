/**
 * @file eosCausalStructuralModel.test.mjs
 * @description BDD test suite for SPEC-338 / CHANGE-200: Autonomous Causal Discovery &
 * Structural Equation Modeling Engine (SCM) (BDD-1803..1808).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EosCausalStructuralModelCore, ScmError } from "../src/core/eosCausalStructuralModel.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/CAUSAL_SCM_RECEIPT.json");

test("SPEC-338 / CHANGE-200: Autonomous Causal Discovery & Structural Equation Modeling Engine (SCM)", async (t) => {
  await t.test("BDD-1803: Acyclic DAG Topological Ordering & Fail-Closed Cycle Rejection", () => {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    const order = scm.getTopologicalOrder();

    // Z must precede X and Y; X and Y must precede C; C must precede D
    assert.ok(order.indexOf("Z") < order.indexOf("X"));
    assert.ok(order.indexOf("Z") < order.indexOf("Y"));
    assert.ok(order.indexOf("X") < order.indexOf("Y"));
    assert.ok(order.indexOf("Y") < order.indexOf("C"));
    assert.ok(order.indexOf("C") < order.indexOf("D"));

    // Adding edge D -> Z or Y -> Z creates a directed cycle and must be rejected
    assert.throws(
      () => scm.addDirectedEdge("D", "Z"),
      (err) => err instanceof ScmError && err.code === "SCM_CYCLE_DETECTED",
    );
    assert.throws(
      () => scm.addDirectedEdge("X", "X"),
      (err) => err instanceof ScmError && err.code === "SCM_CYCLE_DETECTED",
    );
  });

  await t.test(
    "BDD-1804: Lauritzen-Spiegelhalter d-Separation Over Chains, Forks & Colliders (Berkson's Paradox)",
    () => {
      // Graph: Z -> X, Z -> Y (fork); X -> C <- Y (collider); C -> D (collider descendant)
      const scm = new EosCausalStructuralModelCore();
      scm.addVariable({ name: "Z", parents: [], mechanism: () => 0 });
      scm.addVariable({ name: "X", parents: ["Z"], mechanism: (pa) => pa.Z });
      scm.addVariable({ name: "Y", parents: ["Z"], mechanism: (pa) => pa.Z });
      scm.addVariable({ name: "C", parents: ["X", "Y"], mechanism: (pa) => pa.X + pa.Y });
      scm.addVariable({ name: "D", parents: ["C"], mechanism: (pa) => pa.C });

      // Marginally X and Y are connected via fork X <- Z -> Y (not d-separated)
      assert.strictEqual(scm.isDSeparated("X", "Y", []).dSeparated, false);

      // Conditioning on confounder {Z} blocks the fork while collider C remains unconditioned -> d-separated!
      assert.strictEqual(scm.isDSeparated("X", "Y", ["Z"]).dSeparated, true);

      // Conditioning on collider C or its descendant D opens the v-structure X -> C <- Y!
      assert.strictEqual(scm.isDSeparated("X", "Y", ["Z", "C"]).dSeparated, false);
      assert.strictEqual(scm.isDSeparated("X", "Y", ["Z", "D"]).dSeparated, false);
    },
  );

  await t.test("BDD-1805: Backdoor Criterion Verification & Confounding De-biasing", () => {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();

    // Empty set {} fails backdoor criterion because backdoor path X <- Z -> Y is open
    const emptyCheck = scm.verifyBackdoorCriterion("X", "Y", []);
    assert.strictEqual(emptyCheck.validBackdoorSet, false);

    // {Z} blocks X <- Z -> Y and contains no descendants of X -> valid backdoor set!
    const zCheck = scm.verifyBackdoorCriterion("X", "Y", ["Z"]);
    assert.strictEqual(zCheck.validBackdoorSet, true);

    // {Z, C} contains descendant C of X -> invalid backdoor set!
    const zcCheck = scm.verifyBackdoorCriterion("X", "Y", ["Z", "C"]);
    assert.strictEqual(zcCheck.containsDescendantsOfTreatment, true);
    assert.strictEqual(zcCheck.validBackdoorSet, false);

    // Observational samples: true ATE of X on Y is 2.0, but Z confounds X and Y
    const samples = [];
    for (let i = 1; i <= 60; i++) {
      const uZ = Math.sin(i * 1.7) * 2.0;
      const uX = Math.cos(i * 2.3) * 0.8;
      const uY = Math.sin(i * 3.1) * 0.05;
      samples.push(scm.evaluateForward({ Z: uZ, X: uX, Y: uY, C: 0, D: 0 }));
    }

    const est = scm.estimateBackdoorAdjustedAte({
      treatment: "X",
      outcome: "Y",
      adjustmentSet: ["Z"],
      samples,
      trueInterventionalAte: 2.0,
    });

    assert.ok(Math.abs(est.confoundingBias) > 1.5);
    assert.ok(est.adjustedEstimationError < 0.02);
  });

  await t.test("BDD-1806: Graph Mutilation & Surgical Intervention do(X := x)", () => {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    const mutilated = scm.mutilateGraph({ X: 5.0 });

    // Incoming edge Z -> X is severed in mutilated graph
    assert.deepStrictEqual(scm.getParents("X"), ["Z"]);
    assert.deepStrictEqual(mutilated.getParents("X"), []);

    // Upstream ancestor Z is invariant to interventions on X
    const obs = scm.evaluateForward({ Z: 3.0, X: 1.0, Y: 0, C: 0, D: 0 });
    const intv = scm.evaluateForward({ Z: 3.0, X: 1.0, Y: 0, C: 0, D: 0 }, { X: 10.0 });
    assert.strictEqual(intv.Z, obs.Z);
    assert.strictEqual(intv.X, 10.0);

    const ate = scm.computeInterventionalAte("X", "Y", 1, 0);
    assert.strictEqual(ate.trueInterventionalAte, 2.0);
  });

  await t.test("BDD-1807: Three-Step Counterfactual Inference (Abduction, Action, Prediction)", () => {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    const factual = scm.evaluateForward({ Z: 2.0, X: -0.5, Y: 0.4, C: 0.1, D: 0 });

    // Consistency axiom: intervening with factual X reproduces factual Y
    const cfConsistent = scm.inferCounterfactual({
      factualEvidence: factual,
      interventions: { X: factual.X },
      targetVariable: "Y",
    });
    assert.ok(Math.abs(cfConsistent.counterfactualTargetValue - factual.Y) < 1e-12);
    assert.ok(Math.abs(cfConsistent.abductedExogenousNoise.Y - 0.4) < 1e-12);

    // Shifting X by +3.0 shifts counterfactual Y by +6.0 (since structural coefficient is 2.0)
    const cfShifted = scm.inferCounterfactual({
      factualEvidence: factual,
      interventions: { X: factual.X + 3.0 },
      targetVariable: "Y",
    });
    assert.ok(Math.abs(cfShifted.individualTreatmentEffect - 6.0) < 1e-12);
  });

  await t.test("BDD-1808: Deterministic Audit Receipt & Error Guards", () => {
    const scm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    const receiptA = scm.audit();
    const receiptB = scm.audit();

    assert.strictEqual(receiptA.specRef, "SPEC-338");
    assert.strictEqual(receiptA.dagAcyclicEnforced, true);
    assert.strictEqual(receiptA.colliderDsepVerified, true);
    assert.strictEqual(receiptA.backdoorDeconfounded, true);
    assert.strictEqual(receiptA.doInterventionExact, true);
    assert.strictEqual(receiptA.counterfactualConsistent, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receiptA, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
