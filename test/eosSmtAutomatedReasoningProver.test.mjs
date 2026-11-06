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
    { role: "admin", action: "ledger_write", allow: true }
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
      { from: "code", to: "eval" }
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
