/**
 * BDD Test Suite for SPEC-292 & SPEC-342:
 * Live Leslie Lamport TLC Model Checking, Interval Constraint Solver & Verification Honesty
 *
 * Verifies BDD-1527..BDD-1532 & BDD-1828..BDD-1832.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  EosTlcModelChecker,
  EosIntervalConstraintSolver,
  EosZ3SmtSolver,
  CounterexampleTranslator,
  auditFormalProver,
} from "../src/core/eosZ3WasmProver.ts";

describe("SPEC-292 & SPEC-342: Live TLC Model Checking & Verification Honesty", () => {
  // BDD-1527: Live Leslie Lamport TLC Model Checking Execution
  test("BDD-1527: Live Leslie Lamport TLC Model Checking Execution", async () => {
    const specPath = "docs/formal/LmaxDisruptor.tla";
    const result = await EosTlcModelChecker.runTlc(specPath);

    assert.equal(result.specFile, specPath);
    assert.equal(result.executionMode, "LIVE_LOCAL_TLC");
    assert.equal(result.verified, true);
    assert.ok(result.generatedStates > 0);
    assert.ok(result.distinctStates > 0);
    assert.equal(result.invariantViolations, 0);
    assert.equal(result.status, "PASS");
  });

  // BDD-1528: In-Process Constraint Solving (SAT / UNSAT)
  test("BDD-1528: In-Process Constraint Solving (SAT / UNSAT)", () => {
    // 1. Contradiction formula: x > 5 and x < 3 => UNSAT
    const unsatRes = EosIntervalConstraintSolver.solve(
      [{ name: "x", type: "int" }],
      [
        { leftVar: "x", op: ">", rightVal: 5 },
        { leftVar: "x", op: "<", rightVal: 3 },
      ],
    );
    assert.equal(unsatRes.status, "UNSAT");
    assert.ok(unsatRes.reason);

    // 2. Satisfiable formula: x >= 10 and x <= 20 => SAT with assignment
    const satRes = EosIntervalConstraintSolver.solve(
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

    // 3. Deprecated alias parity
    assert.strictEqual(EosZ3SmtSolver, EosIntervalConstraintSolver);
  });

  // BDD-1529: Inductive Invariant Proving across Transitions
  test("BDD-1529: Inductive Invariant Proving across Transitions", () => {
    // Domain closed under transition: x' = (x + 1) mod 5
    const closedDomain = [0, 1, 2, 3, 4].map((x) => ({ x }));
    const result = EosIntervalConstraintSolver.proveInductiveInvariant({
      invariantName: "ModularNonNegativeCounter",
      initialPredicate: (s) => s.x === 0,
      transition: (s) => ({ x: (Number(s.x) + 1) % 5 }),
      invariant: (s) => Number(s.x) >= 0 && Number(s.x) < 5,
      domain: closedDomain,
    });

    assert.equal(result.status, "INDUCTIVE_INVARIANT_PROVEN");
    assert.equal(result.baseCaseProven, true);
    assert.equal(result.inductiveStepProven, true);
    assert.equal(result.domainClosedUnderTransition, true);
    assert.equal(result.counterexample, undefined);
  });

  // BDD-1530: Invariant Refutation and Counterexample Detection
  test("BDD-1530: Invariant Refutation and Counterexample Detection", () => {
    // Flawed Invariant: x < 5, Initial: x = 0, Transition: x' = x + 2
    const domain = [{ x: 0 }, { x: 2 }, { x: 4 }, { x: 6 }];
    const result = EosIntervalConstraintSolver.proveInductiveInvariant({
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

  // BDD-1531: Counterexample Trace Translation to BDD Test
  test("BDD-1531: Counterexample Trace Translation to BDD Test", () => {
    const counterexample = { bufferIndex: 1024, ringCapacity: 512, hasOverflow: true };
    const testCode = CounterexampleTranslator.translateToBddTest("RingBufferOverflowSafety", counterexample);

    assert.ok(testCode.includes('test("Counterexample Regression: RingBufferOverflowSafety"'));
    assert.ok(testCode.includes("const bufferIndex = 1024;"));
    assert.ok(testCode.includes("const ringCapacity = 512;"));
    assert.ok(testCode.includes("const hasOverflow = true;"));
    assert.ok(testCode.includes("assert.equal(bufferIndex, 1024);"));
  });

  // BDD-1532: Cryptographic Formal Prover Audit Receipt Verification
  test("BDD-1532: Cryptographic Formal Prover Audit Receipt Verification", async () => {
    const receipt = await auditFormalProver({ rootDir: process.cwd(), emitReceipt: true });

    assert.equal(receipt.specRef, "SPEC-292");
    assert.ok(receipt.totalTlaSpecsInventoried >= 50);
    assert.ok(receipt.totalTlaSpecsChecked >= 1);
    assert.ok(receipt.totalSmtTheoremsProven >= 1);
    assert.ok(receipt.inductiveInvariantsVerified >= 1);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "Z3_PROVER_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  // BDD-1828: TLC Unavailable Is Reported As NOT_VERIFIED (SPEC-342 FR-1)
  test("BDD-1828: TLC Unavailable Is Reported As NOT_VERIFIED", async () => {
    const specPath = "docs/formal/LmaxDisruptor.tla";
    const res = await EosTlcModelChecker.runTlc(specPath, {
      jarPath: path.join(process.cwd(), "tools", "non_existent_tlc.jar"),
    });

    assert.equal(res.status, "NOT_VERIFIED");
    assert.equal(res.verified, false);
    assert.equal(res.executionMode, "UNAVAILABLE");
    assert.equal(res.generatedStates, 0);
    assert.equal(res.distinctStates, 0);
    assert.ok(typeof res.reason === "string" && res.reason.includes("non_existent_tlc.jar"));
  });

  // BDD-1829: Live TLC Detects Invariant Violation Without Leaving Repo Metadata (SPEC-342 FR-2)
  test("BDD-1829: Live TLC Detects Invariant Violation Without Leaving Repo Metadata", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-tlc-seeded-"));
    try {
      const tlaContent = `---- MODULE SeededBug ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x' = x + 1
Invariant == x < 3
====`;
      const cfgContent = `INIT Init
NEXT Next
INVARIANT Invariant`;
      const tlaPath = path.join(tmpDir, "SeededBug.tla");
      const cfgPath = path.join(tmpDir, "SeededBug.cfg");
      fs.writeFileSync(tlaPath, tlaContent, "utf8");
      fs.writeFileSync(cfgPath, cfgContent, "utf8");

      const res = await EosTlcModelChecker.runTlc(tlaPath);
      assert.equal(res.status, "INVARIANT_VIOLATION");
      assert.equal(res.verified, true);
      assert.equal(res.invariantViolations, 1);
      assert.ok(res.generatedStates > 0);
      assert.ok(typeof res.reason === "string" && res.reason.includes("Invariant Invariant is violated"));

      // Ensure no "states/" directory was left in process.cwd()
      const cwdStates = path.join(process.cwd(), "states");
      if (fs.existsSync(cwdStates)) {
        // If it exists, make sure SeededBug metadata is not inside it
        const contents = fs.readdirSync(cwdStates);
        assert.ok(!contents.some((c) => c.includes("SeededBug")));
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // BDD-1830: Interval Constraint Solver Unbounded Soundness & Self-Check (SPEC-342 FR-3)
  test("BDD-1830: Interval Constraint Solver Unbounded Soundness & Self-Check", () => {
    // 1. Solution outside former [-1000, 1000] window
    const bigRes = EosIntervalConstraintSolver.solve(
      [{ name: "x", type: "int" }],
      [{ leftVar: "x", op: ">", rightVal: 5000 }],
    );
    assert.equal(bigRes.status, "SAT");
    assert.equal(bigRes.model?.x, 5001);

    // 2. Not-equal constraint resolution
    const neqRes = EosIntervalConstraintSolver.solve(
      [{ name: "x", type: "int" }],
      [
        { leftVar: "x", op: ">=", rightVal: 0 },
        { leftVar: "x", op: "!=", rightVal: 0 },
      ],
    );
    assert.equal(neqRes.status, "SAT");
    assert.equal(neqRes.model?.x, 1);

    // 3. Exhausted discrete domain => UNSAT
    const exhaustRes = EosIntervalConstraintSolver.solve(
      [{ name: "x", type: "int" }],
      [
        { leftVar: "x", op: ">=", rightVal: 0 },
        { leftVar: "x", op: "<=", rightVal: 2 },
        { leftVar: "x", op: "!=", rightVal: 0 },
        { leftVar: "x", op: "!=", rightVal: 1 },
        { leftVar: "x", op: "!=", rightVal: 2 },
      ],
    );
    assert.equal(exhaustRes.status, "UNSAT");

    // 4. Outside fragment => UNKNOWN
    const unkRes = EosIntervalConstraintSolver.solve(
      [{ name: "x", type: "int" }],
      [{ leftVar: "x", op: "==", rightVal: "y" }],
    );
    assert.equal(unkRes.status, "UNKNOWN");
  });

  // BDD-1831: Inductive Proof Distinguishes Closed Domains from Sampled (SPEC-342 FR-4)
  test("BDD-1831: Inductive Proof Distinguishes Closed Domains from Sampled", () => {
    // Unclosed domain (0 -> 1 -> 2 -> 3 not in domain)
    const sampledResult = EosIntervalConstraintSolver.proveInductiveInvariant({
      invariantName: "NonNegativeCounterSampled",
      initialPredicate: (s) => s.x === 0,
      transition: (s) => ({ x: Number(s.x) + 1 }),
      invariant: (s) => Number(s.x) >= 0,
      domain: [{ x: 0 }, { x: 1 }, { x: 2 }],
    });
    assert.equal(sampledResult.status, "HOLDS_ON_SAMPLED_DOMAIN");
    assert.equal(sampledResult.domainClosedUnderTransition, false);
    assert.equal(sampledResult.baseCaseProven, true);
    assert.equal(sampledResult.inductiveStepProven, true);
  });

  // BDD-1832: Formal Audit Receipt Honesty And Deterministic Signature (SPEC-342 FR-5)
  test("BDD-1832: Formal Audit Receipt Honesty And Deterministic Signature", async () => {
    const tmpEvidence = fs.mkdtempSync(path.join(os.tmpdir(), "eos-evd-audit-"));
    try {
      const r1 = await auditFormalProver({ rootDir: process.cwd(), emitReceipt: true, evidenceDir: tmpEvidence });
      const r2 = await auditFormalProver({ rootDir: process.cwd(), emitReceipt: false });

      assert.equal(r1.specRef, "SPEC-292");
      assert.ok(r1.totalTlaSpecsInventoried >= 50);
      assert.equal(r1.totalTlaSpecsChecked, 1);
      assert.equal(r1.tlcSampleStatus, "PASS");
      assert.equal(r1.sha256Signature, r2.sha256Signature);
    } finally {
      fs.rmSync(tmpEvidence, { recursive: true, force: true });
    }
  });
});
