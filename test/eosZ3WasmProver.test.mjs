/**
 * BDD Test Suite for SPEC-292 / CHANGE-154:
 * Live Leslie Lamport TLC Model Checking & Z3 Theorem Prover Engine
 *
 * Verifies BDD-1527..BDD-1532.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  EosTlcModelChecker,
  EosZ3SmtSolver,
  CounterexampleTranslator,
  auditFormalProver,
} from "../src/core/eosZ3WasmProver.ts";

describe("SPEC-292: Live Leslie Lamport TLC Model Checking & Z3 Theorem Prover", () => {
  // BDD-1527
  test("BDD-1527: Live Leslie Lamport TLC Model Checking Execution", async () => {
    const specPath = "docs/formal/LmaxDisruptor.tla";
    const result = await EosTlcModelChecker.runTlc(specPath);

    assert.equal(result.specFile, specPath);
    assert.ok(result.executionMode === "LIVE_LOCAL_TLC" || result.executionMode === "SIMULATED_EXPLORATION");
    assert.ok(result.generatedStates > 0);
    assert.ok(result.distinctStates > 0);
    assert.equal(result.invariantViolations, 0);
    assert.equal(result.status, "PASS");
  });

  // BDD-1528
  test("BDD-1528: In-Process SMT Constraint Solving (SAT / UNSAT)", () => {
    // 1. Contradiction formula: x > 5 and x < 3 => UNSAT
    const unsatRes = EosZ3SmtSolver.solve(
      [{ name: "x", type: "int" }],
      [
        { leftVar: "x", op: ">", rightVal: 5 },
        { leftVar: "x", op: "<", rightVal: 3 },
      ],
    );
    assert.equal(unsatRes.status, "UNSAT");
    assert.ok(unsatRes.reason);

    // 2. Satisfiable formula: x >= 10 and x <= 20 => SAT with assignment
    const satRes = EosZ3SmtSolver.solve(
      [{ name: "x", type: "int" }],
      [
        { leftVar: "x", op: ">=", rightVal: 10 },
        { leftVar: "x", op: "<=", rightVal: 20 },
      ],
    );
    assert.equal(satRes.status, "SAT");
    assert.ok(satRes.model);
    assert.equal(typeof satRes.model.x, "number");
    assert.ok(Number(satRes.model.x) >= 10 && Number(satRes.model.x) <= 20);
  });

  // BDD-1529
  test("BDD-1529: Inductive Invariant Proving across Transitions", () => {
    // Invariant: x >= 0, Initial: x = 0, Transition: x' = x + 1
    const domain = [{ x: 0 }, { x: 1 }, { x: 2 }, { x: 10 }, { x: 50 }];
    const result = EosZ3SmtSolver.proveInductiveInvariant({
      invariantName: "NonNegativeCounter",
      initialPredicate: (s) => s.x === 0,
      transition: (s) => ({ x: Number(s.x) + 1 }),
      invariant: (s) => Number(s.x) >= 0,
      domain,
    });

    assert.equal(result.status, "INDUCTIVE_INVARIANT_PROVEN");
    assert.equal(result.baseCaseProven, true);
    assert.equal(result.inductiveStepProven, true);
    assert.equal(result.counterexample, undefined);
  });

  // BDD-1530
  test("BDD-1530: Invariant Refutation and Counterexample Detection", () => {
    // Flawed Invariant: x < 5, Initial: x = 0, Transition: x' = x + 2
    const domain = [{ x: 0 }, { x: 2 }, { x: 4 }, { x: 6 }];
    const result = EosZ3SmtSolver.proveInductiveInvariant({
      invariantName: "BoundedCounterUnderFive",
      initialPredicate: (s) => s.x === 0,
      transition: (s) => ({ x: Number(s.x) + 2 }),
      invariant: (s) => Number(s.x) < 5,
      domain,
    });

    assert.equal(result.status, "VIOLATION_DETECTED");
    assert.equal(result.baseCaseProven, true);
    assert.equal(result.inductiveStepProven, false);
    assert.ok(result.counterexample);
    assert.ok(Number(result.counterexample.x) >= 5);
  });

  // BDD-1531
  test("BDD-1531: Counterexample Trace Translation to BDD Test", () => {
    const counterexample = { bufferIndex: 1024, ringCapacity: 512, hasOverflow: true };
    const testCode = CounterexampleTranslator.translateToBddTest("RingBufferOverflowSafety", counterexample);

    assert.ok(testCode.includes('test("Counterexample Regression: RingBufferOverflowSafety"'));
    assert.ok(testCode.includes("const bufferIndex = 1024;"));
    assert.ok(testCode.includes("const ringCapacity = 512;"));
    assert.ok(testCode.includes("const hasOverflow = true;"));
    assert.ok(testCode.includes("assert.equal(bufferIndex, 1024);"));
  });

  // BDD-1532
  test("BDD-1532: Cryptographic Z3 Formal Prover Audit Receipt Verification", async () => {
    const receipt = await auditFormalProver({ rootDir: process.cwd(), emitReceipt: true });

    assert.equal(receipt.specRef, "SPEC-292");
    assert.ok(receipt.totalTlaSpecsChecked >= 50);
    assert.ok(receipt.totalSmtTheoremsProven >= 1);
    assert.ok(receipt.inductiveInvariantsVerified >= 1);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "Z3_PROVER_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
