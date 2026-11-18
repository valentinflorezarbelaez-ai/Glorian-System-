/**
 * @file eosCausalStructuralModel.test.mjs
 * @description BDD test suite for SPEC-338 / CHANGE-200: Autonomous Causal Discovery &
 * Structural Equation Modeling Engine (SCM) (BDD-1803..1808).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EosCausalStructuralModelCore, ScmError } from "../src/core/eosCausalStructuralModel.ts";

const RECEIPT_PATH = path.join(os.tmpdir(), `eos-test-CAUSAL_SCM_RECEIPT-${process.pid}.json`);

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

  await t.test("BDD-1808B: Mutation-Hardening ScmError Boundaries, Graph Queries & Exact Numerics", () => {
    const scm = new EosCausalStructuralModelCore();

    // addVariable fail-closed parameter, unknown-parent & cycle guards
    assert.throws(
      () => scm.addVariable(null),
      (err) => err instanceof ScmError && err.name === "ScmError" && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => scm.addVariable({ name: "   ", parents: [], mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => scm.addVariable({ name: "A", parents: null, mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => scm.addVariable({ name: "A", parents: [], mechanism: "not-fn" }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => scm.addVariable({ name: "A", parents: ["A"], mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_CYCLE_DETECTED",
    );
    assert.throws(
      () => scm.addVariable({ name: "A", parents: ["GHOST"], mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => scm.addVariable({ name: "A", parents: ["  "], mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );

    scm.addVariable({ name: "P1", parents: [], mechanism: () => 1 });
    scm.addVariable({ name: "P2", parents: [], mechanism: () => 2 });
    // Duplicate parents deduplicated & updating existing node clears old parent links
    scm.addVariable({ name: "CH", parents: ["P1", "P1"], mechanism: (pa) => pa.P1 * 3 });
    assert.deepStrictEqual(scm.getParents("CH"), ["P1"]);
    scm.addVariable({ name: "CH", parents: ["P2"], mechanism: (pa) => pa.P2 * 5 });
    assert.deepStrictEqual(scm.getParents("CH"), ["P2"]);
    assert.strictEqual(scm.getDescendants("P1").has("CH"), false);
    assert.strictEqual(scm.getDescendants("P2").has("CH"), true);
    assert.throws(
      () => scm.addVariable({ name: "P2", parents: ["CH"], mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_CYCLE_DETECTED",
    );

    // addDirectedEdge default weight, duplicate suppression, and guards
    scm.addDirectedEdge("P1", "CH");
    scm.addDirectedEdge("P1", "CH", 2);
    assert.deepStrictEqual(scm.getParents("CH"), ["P2", "P1"]);
    const edgeEval = scm.evaluateForward({ P1: 1, P2: 1, CH: 0 });
    assert.strictEqual(edgeEval.CH, 21);
    assert.throws(
      () => scm.addDirectedEdge("NOPE", "CH"),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => scm.addDirectedEdge("CH", "NOPE"),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );

    // getParents / getAncestors / getDescendants boundaries
    const bench = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    assert.throws(
      () => bench.getParents("NOPE"),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => bench.getAncestors(null),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.getAncestors(["NOPE"]),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.deepStrictEqual([...bench.getAncestors(["C"])].sort(), ["C", "X", "Y", "Z"]);
    assert.deepStrictEqual([...bench.getDescendants("Y")].sort(), ["C", "D"]);

    // isDSeparated & verifyBackdoorCriterion guards
    assert.throws(
      () => bench.isDSeparated("X", "Y", null),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.isDSeparated("BAD", "Y", []),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => bench.isDSeparated("X", "Y", ["BAD"]),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    const selfCond = bench.isDSeparated("X", "Y", ["X"]);
    assert.strictEqual(selfCond.dSeparated, true);
    assert.ok(selfCond.ancestralSubgraphNodes.includes("Z"));
    assert.strictEqual(selfCond.ancestralSubgraphNodes.includes("D"), false);

    assert.throws(
      () => bench.verifyBackdoorCriterion("X", "Y", null),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.verifyBackdoorCriterion("BAD", "Y", ["Z"]),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    const selfBackdoor = bench.verifyBackdoorCriterion("X", "Y", ["X"]);
    assert.strictEqual(selfBackdoor.containsDescendantsOfTreatment, true);
    assert.strictEqual(selfBackdoor.validBackdoorSet, false);

    // mutilateGraph, evaluateForward, computeInterventionalAte
    assert.throws(
      () => bench.mutilateGraph([]),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.mutilateGraph({ GHOST: 1 }),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => bench.mutilateGraph({ X: Number.POSITIVE_INFINITY }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.evaluateForward([], {}),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.evaluateForward({ Z: Number.NaN }, {}),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.computeInterventionalAte("X", "MISSING", 1, 0),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => bench.computeInterventionalAte("X", "Y", Number.NaN, 0),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    const defaultAte = bench.computeInterventionalAte("X", "Y");
    assert.strictEqual(defaultAte.treatedValue, 1);
    assert.strictEqual(defaultAte.controlValue, 0);
    assert.strictEqual(defaultAte.expectedOutcomeTreated, 2);
    assert.strictEqual(defaultAte.expectedOutcomeControl, 0);
    assert.deepStrictEqual(defaultAte.severedParents, ["Z"]);

    // estimateBackdoorAdjustedAte & inferCounterfactual guards
    assert.throws(
      () =>
        bench.estimateBackdoorAdjustedAte({
          treatment: "X",
          outcome: "Y",
          adjustmentSet: ["Z"],
          samples: [{ Z: 1, X: 1, Y: 2 }],
          trueInterventionalAte: 2.0,
        }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () =>
        bench.estimateBackdoorAdjustedAte({
          treatment: "X",
          outcome: "Y",
          adjustmentSet: ["Z"],
          samples: [
            { Z: 1, X: 1, Y: 2 },
            { Z: 2, X: 2, Y: Number.NaN },
          ],
          trueInterventionalAte: 2.0,
        }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () =>
        bench.estimateBackdoorAdjustedAte({
          treatment: "X",
          outcome: "Y",
          adjustmentSet: ["Z", "C"],
          samples: [
            { Z: 1, X: 1, Y: 2, C: 1 },
            { Z: 2, X: 2, Y: 4, C: 2 },
          ],
          trueInterventionalAte: 2.0,
        }),
      (err) => err instanceof ScmError && err.code === "SCM_BACKDOOR_VIOLATION",
    );
    const twoSamplesEst = bench.estimateBackdoorAdjustedAte({
      treatment: "X",
      outcome: "Y",
      adjustmentSet: ["Z"],
      samples: [
        { Z: 0, X: 0, Y: 0 },
        { Z: 1, X: 2, Y: 7 },
        { Z: 2, X: 1, Y: 8 },
      ],
      trueInterventionalAte: 2.0,
    });
    assert.strictEqual(twoSamplesEst.sampleCount, 3);
    assert.ok(twoSamplesEst.adjustedEstimationError < 0.01);

    const factual = bench.evaluateForward({ Z: 1, X: 0.5, Y: 0.1, C: 0, D: 0 });
    assert.throws(
      () => bench.inferCounterfactual({ factualEvidence: null, interventions: {}, targetVariable: "Y" }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.inferCounterfactual({ factualEvidence: { Z: 1 }, interventions: {}, targetVariable: "Y" }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () =>
        bench.inferCounterfactual({
          factualEvidence: { ...factual, Y: Number.NaN },
          interventions: { X: 1 },
          targetVariable: "Y",
        }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => bench.inferCounterfactual({ factualEvidence: factual, interventions: { X: 1 }, targetVariable: "NOPE" }),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );

    const auditSummary = bench.audit();
    assert.strictEqual(auditSummary.trueAte, 2);
    assert.ok(Math.abs(auditSummary.naiveBiasedSlope) > 3);
    assert.ok(Math.abs(auditSummary.backdoorAdjustedAte - 2) < 0.02);
  });
});
