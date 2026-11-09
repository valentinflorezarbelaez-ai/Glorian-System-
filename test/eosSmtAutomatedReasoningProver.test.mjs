/**
 * EOS SYSTEM — SPEC-063 BDD TEST SUITE
 * SMT Automated Reasoning & Formal Logic Prover Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosSmtAutomatedReasoningProver } from "../src/core/eosSmtAutomatedReasoningProver.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-192: ABAC Security Policy Mathematical Proof (UNSAT is Secure)", () => {
  const rules = [
    { role: "guest", action: "ledger_read", allow: true },
    { role: "guest", action: "ledger_write", allow: false },
    { role: "admin", action: "ledger_write", allow: true },
  ];

  // Prove that guest cannot perform ledger_write
  const proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, "guest", "ledger_write");

  assert.equal(proof.verdict, "PROVED_UNSAT_SECURE");
  assert.equal(proof.isSatisfiable, false);
  assert.ok(proof.evaluatedClausesCount >= 4);
  assert.equal(proof.sha256Receipt.length, 64);
});

test("BDD-193: Topological Dependency Satisfiability Proof", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-smt-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const nodes = ["planner", "spec", "code", "eval"];
    const edges = [
      { from: "planner", to: "spec" },
      { from: "spec", to: "code" },
      { from: "code", to: "eval" },
    ];

    const proof = EosSmtAutomatedReasoningProver.proveAcyclicTopology(nodes, edges);

    assert.equal(proof.verdict, "SAT_ACYCLIC_ORDER_VALID");
    assert.equal(proof.isSatisfiable, true);
    assert.equal(proof.sha256Receipt.length, 64);

    // Verify Ledger persistence
    const saved = EosSmtAutomatedReasoningProver.recordReceiptInLedger(proof, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const recent = ledger.listRecent(5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].category, "VERIFICATION_RECEIPT");
    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-194: SMT DPLL Branching, Contradiction and SAT Models", () => {
  // Precondition: clauses must be an array
  assert.throws(() => EosSmtAutomatedReasoningProver.solveCnf("not-array"), /clauses must be an array/);

  // Unit clause contradiction: A and !A
  const contradictionResult = EosSmtAutomatedReasoningProver.solveCnf([["A"], ["B", "C"], ["!A"]]);
  assert.equal(contradictionResult.sat, false);
  assert.ok(contradictionResult.unsatCore.includes("Unsatisfiable"));

  // Branching: 3 clauses requiring branching search (A || B), (!A || B), (A || !B)
  // Solution: A=true, B=true satisfies all
  const branchingCnf = [
    ["A", "B"],
    ["!A", "B"],
    ["A", "!B"],
  ];
  const branchSol = EosSmtAutomatedReasoningProver.solveCnf(branchingCnf);
  assert.equal(branchSol.sat, true);
  assert.equal(branchSol.model.A, true);
  assert.equal(branchSol.model.B, true);

  // Unsat via branching: Pigeonhole or conflict on false branch
  // (A || B) && (!A || B) && (A || !B) && (!A || !B) => UNSAT
  const unsatBranching = [
    ["A", "B"],
    ["!A", "B"],
    ["A", "!B"],
    ["!A", "!B"],
  ];
  const unsatSol = EosSmtAutomatedReasoningProver.solveCnf(unsatBranching);
  assert.equal(unsatSol.sat, false);
});

test("BDD-195: ABAC Violation Detection, Cyclic Deadlock & Ledger Persistence", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-smt-violation-test-"));

  try {
    // 1. ABAC Violation (allow rule permits sensitiveAction)
    const permissiveRules = [{ role: "guest", action: "export_database", allow: true }];
    const violationReport = EosSmtAutomatedReasoningProver.proveAbacSafety(permissiveRules, "guest", "export_database");
    assert.equal(violationReport.verdict, "VIOLATION_SAT_MODEL_FOUND");
    assert.equal(violationReport.isSatisfiable, true);

    // 2. Cyclic Topology Deadlock Detection
    const cyclicNodes = ["A", "B"];
    const cyclicEdges = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];
    const deadlockReport = EosSmtAutomatedReasoningProver.proveAcyclicTopology(cyclicNodes, cyclicEdges);
    assert.equal(deadlockReport.verdict, "UNSAT_CYCLE_DEADLOCK");
    assert.equal(deadlockReport.isSatisfiable, false);

    // 3. Ledger paths: directory, .db, default, and error branch
    const savedDir = EosSmtAutomatedReasoningProver.recordReceiptInLedger(deadlockReport, tmpDir);
    assert.equal(savedDir, true);

    const dbPath = path.join(tmpDir, "custom.db");
    const savedDb = EosSmtAutomatedReasoningProver.recordReceiptInLedger(deadlockReport, dbPath);
    assert.equal(savedDb, true);

    const savedDefault = EosSmtAutomatedReasoningProver.recordReceiptInLedger(deadlockReport);
    assert.equal(typeof savedDefault, "boolean");

    // Catch branch
    const originalAppend = EosDurableSqliteLedger.prototype.appendEntry;
    try {
      EosDurableSqliteLedger.prototype.appendEntry = () => {
        throw new Error("Fault simulation");
      };
      const failed = EosSmtAutomatedReasoningProver.recordReceiptInLedger(deadlockReport, tmpDir);
      assert.equal(failed, false);
    } finally {
      EosDurableSqliteLedger.prototype.appendEntry = originalAppend;
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});
