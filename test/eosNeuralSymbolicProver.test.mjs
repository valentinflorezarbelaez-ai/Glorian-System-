/**
 * @file eosNeuralSymbolicProver.test.mjs
 * @description Automated test suite for SPEC-349 / CHANGE-211: Self-Synthesizing Neural-Symbolic Prover.
 *
 * Verifies BDD-1873 through BDD-1878:
 * - BDD-1873: DPLL / CDCL Propositional SAT solver core.
 * - BDD-1874: Linear integer bound & interval propagation.
 * - BDD-1875: Trace-guided predicate candidate induction.
 * - BDD-1876: Inductive invariant verification triple (Initiation, Consecution, Safety).
 * - BDD-1877: CEGAR refinement loop convergence.
 * - BDD-1878: Prover self-auditing harness and proof receipt emission.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import { EosNeuralSymbolicProverCore } from "../src/core/eosNeuralSymbolicProver.ts";

test("BDD-1873: DPLL / CDCL Propositional SAT Solver Core", () => {
  // Test 1: Simple satisfiable formula
  // (x1 or x2) and (!x1 or x3)
  const satFormula = [
    [1, 2],
    [-1, 3],
  ];
  const resSat = EosNeuralSymbolicProverCore.solveCnf(satFormula);
  assert.equal(resSat.sat, true);
  assert.ok(resSat.assignment);

  // Test 2: Unsatisfiable formula (contradiction)
  // (x1) and (!x1)
  const unsatFormula1 = [[1], [-1]];
  const resUnsat1 = EosNeuralSymbolicProverCore.solveCnf(unsatFormula1);
  assert.equal(resUnsat1.sat, false);

  // Test 3: 3-variable unsatisfiable formula
  // (x1 or x2) and (!x1 or x2) and (x1 or !x2) and (!x1 or !x2)
  const unsatFormula2 = [
    [1, 2],
    [-1, 2],
    [1, -2],
    [-1, -2],
  ];
  const resUnsat2 = EosNeuralSymbolicProverCore.solveCnf(unsatFormula2);
  assert.equal(resUnsat2.sat, false);
});

test("BDD-1874: Linear Integer Bound & Interval Propagation", () => {
  // Constraints: x <= 15, x >= 5, y <= 20, y >= 0
  const constraints = [
    { coefficients: { x: 1 }, op: "<=", bound: 15 },
    { coefficients: { x: 1 }, op: ">=", bound: 5 },
    { coefficients: { y: 1 }, op: "<=", bound: 20 },
    { coefficients: { y: 1 }, op: ">=", bound: 0 },
  ];

  const res = EosNeuralSymbolicProverCore.propagateIntervals(["x", "y"], constraints);
  assert.equal(res.consistent, true);
  assert.equal(res.intervals.x.min, 5);
  assert.equal(res.intervals.x.max, 15);
  assert.equal(res.intervals.y.min, 0);
  assert.equal(res.intervals.y.max, 20);

  // Contradictory constraints: z >= 10 and z <= 4
  const badConstraints = [
    { coefficients: { z: 1 }, op: ">=", bound: 10 },
    { coefficients: { z: 1 }, op: "<=", bound: 4 },
  ];
  const badRes = EosNeuralSymbolicProverCore.propagateIntervals(["z"], badConstraints);
  assert.equal(badRes.consistent, false);
});

test("BDD-1875: Trace-Based Predicate Candidate Induction", () => {
  const traces = [
    { req: 1, resp: 2 },
    { req: 3, resp: 5 },
    { req: 2, resp: 4 },
    { req: 5, resp: 10 },
  ];

  const candidates = EosNeuralSymbolicProverCore.inducePredicatesFromTraces(traces);
  assert.ok(candidates.length >= 3);

  // Check box bounds
  const reqBound = candidates.find((c) => c.id === "pred_bound_req");
  assert.ok(reqBound);
  assert.equal(reqBound.test({ req: 1, resp: 0 }), true);
  assert.equal(reqBound.test({ req: 6, resp: 0 }), false);

  // Check relational invariant: req <= resp
  const relBound = candidates.find((c) => c.id === "pred_rel_req_lte_resp");
  assert.ok(relBound);
  assert.equal(relBound.test({ req: 4, resp: 8 }), true);
  assert.equal(relBound.test({ req: 9, resp: 2 }), false);
});

test("BDD-1876: Inductive Invariant Verification Triple", () => {
  const initStates = [{ count: 0 }];
  const transitionFn = (s) => [{ count: (s.count + 1) % 5 }];
  const safetyFn = (s) => s.count >= 0 && s.count < 5;

  const sampleStates = [{ count: 0 }, { count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }];

  // Sound inductive invariant: 0 <= count < 5
  const soundCandidate = {
    id: "modulo_counter_bound",
    expression: "0 <= count <= 4",
    test: (s) => s.count >= 0 && s.count <= 4,
  };

  const resSound = EosNeuralSymbolicProverCore.verifyInductiveTriple(
    initStates,
    transitionFn,
    safetyFn,
    soundCandidate,
    sampleStates,
  );
  assert.equal(resSound.initiated, true);
  assert.equal(resSound.consecutive, true);
  assert.equal(resSound.safe, true);
  assert.equal(resSound.inductive, true);

  // Unsound candidate: count == 0 (not consecutive because 0 transitions to 1)
  const unsoundCandidate = {
    id: "only_zero",
    expression: "count == 0",
    test: (s) => s.count === 0,
  };
  const resUnsound = EosNeuralSymbolicProverCore.verifyInductiveTriple(
    initStates,
    transitionFn,
    safetyFn,
    unsoundCandidate,
    sampleStates,
  );
  assert.equal(resUnsound.initiated, true);
  assert.equal(resUnsound.consecutive, false);
  assert.ok(resUnsound.counterexample);
  assert.equal(resUnsound.counterexample.preState.count, 0);
  assert.equal(resUnsound.counterexample.postState.count, 1);
});

test("BDD-1877: CEGAR Refinement Loop Convergence", () => {
  const initStates = [{ tokens: 5, capacity: 5 }];
  const transitionFn = (s) => {
    const next = [];
    if (s.tokens > 0) next.push({ tokens: s.tokens - 1, capacity: s.capacity });
    if (s.tokens < s.capacity) next.push({ tokens: s.tokens + 1, capacity: s.capacity });
    return next;
  };
  const safetyFn = (s) => s.tokens >= 0 && s.tokens <= s.capacity;
  const initialTraces = [
    { tokens: 5, capacity: 5 },
    { tokens: 4, capacity: 5 },
  ];
  const sampleSpace = [];
  for (let t = 0; t <= 5; t++) {
    sampleSpace.push({ tokens: t, capacity: 5 });
  }

  const loopRes = EosNeuralSymbolicProverCore.runCegarLoop(
    initStates,
    transitionFn,
    safetyFn,
    initialTraces,
    sampleSpace,
    10,
  );

  assert.equal(loopRes.finalVerification.inductive, true);
  assert.equal(loopRes.finalVerification.initiated, true);
  assert.equal(loopRes.finalVerification.consecutive, true);
  assert.equal(loopRes.finalVerification.safe, true);
});

test("BDD-1878: Prover Self-Auditing Harness & Receipt Emission", () => {
  const receipt = EosNeuralSymbolicProverCore.audit();
  assert.equal(receipt.status, "VERIFIED");
  assert.equal(receipt.satSolverVerified, true);
  assert.equal(receipt.boundPropagationVerified, true);
  assert.equal(receipt.inductiveSynthesisVerified, true);
  assert.equal(receipt.cegarRefinementVerified, true);
  assert.equal(receipt.specId, "SPEC-349");
  assert.equal(receipt.proofCertificateSha256.length, 64);

  const receiptPath = resolveEvidencePath("NEURAL_SYMBOLIC_PROVER_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
});
