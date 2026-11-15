/**
 * EOS System — Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor Test Suite
 * SPEC-285 (CHANGE-147) — BDD-1485..1490
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosDeadlockDetectionGovernor } from "../src/core/eosDeadlockDetectionGovernor.ts";

const SAMPLE_PATH = path.resolve("templates/concurrency/sample-deadlock-wfg.json");
const RECEIPT_PATH = path.resolve("docs/evidence/DEADLOCK_RECEIPT.json");

describe("SPEC-285: Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor", () => {
  const sampleWfg = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));

  it("BDD-1485: Wait-For Graph Construction from Transaction Events", () => {
    const graph = EosDeadlockDetectionGovernor.buildWfg(sampleWfg.transactions, "test-wfg-01");

    assert.equal(graph.graphId, "test-wfg-01");
    assert.equal(graph.vertices.length, 3);
    assert.deepEqual(graph.vertices, ["tx-100", "tx-200", "tx-300"]);
    assert.equal(graph.edges.length, 3);

    assert.equal(graph.edges[0].from, "tx-100");
    assert.equal(graph.edges[0].to, "tx-200");
    assert.equal(graph.edges[0].resource, "order-status-99");
  });

  it("BDD-1486: Elementary Cycle Detection in Cyclic Dependency Graph", () => {
    const graph = EosDeadlockDetectionGovernor.buildWfg(sampleWfg.transactions);
    const report = EosDeadlockDetectionGovernor.detectDeadlocks(graph);

    assert.equal(report.hasDeadlock, true);
    assert.equal(report.cycles.length, 1);
    assert.deepEqual(report.cycles[0], ["tx-100", "tx-200", "tx-300", "tx-100"]);
    assert.deepEqual(report.victims, ["tx-300"]);
  });

  it("BDD-1487: Acyclic Dependency Graph Validation", () => {
    const acyclicTransactions = [
      {
        txId: "tx-A",
        timestamp: 100,
        holds: ["res-1"],
        waitingFor: [],
      },
      {
        txId: "tx-B",
        timestamp: 200,
        holds: ["res-2"],
        waitingFor: ["res-1"],
      },
      {
        txId: "tx-C",
        timestamp: 300,
        holds: [],
        waitingFor: ["res-2"],
      },
    ];

    const graph = EosDeadlockDetectionGovernor.buildWfg(acyclicTransactions);
    const report = EosDeadlockDetectionGovernor.detectDeadlocks(graph);

    assert.equal(report.hasDeadlock, false);
    assert.equal(report.cycles.length, 0);
    assert.equal(report.victims.length, 0);
  });

  it("BDD-1488: Deterministic Victim Selection and Cycle Resolution", () => {
    const graph = EosDeadlockDetectionGovernor.buildWfg(sampleWfg.transactions);
    const { resolvedGraph, abortedTxIds } = EosDeadlockDetectionGovernor.resolveDeadlocks(graph);

    assert.deepEqual(abortedTxIds, ["tx-300"]);
    assert.equal(resolvedGraph.vertices.includes("tx-300"), false);

    // Verify resolved graph is now acyclic
    const postReport = EosDeadlockDetectionGovernor.detectDeadlocks(resolvedGraph);
    assert.equal(postReport.hasDeadlock, false);
    assert.equal(postReport.cycles.length, 0);
  });

  it("BDD-1489: Wound-Wait Protocol Conflict Resolution", () => {
    const olderTx = {
      txId: "tx-old",
      timestamp: 1000,
      holds: [],
      waitingFor: ["res-X"],
    };
    const youngerTx = {
      txId: "tx-young",
      timestamp: 2000,
      holds: ["res-X"],
      waitingFor: [],
    };

    // Older requests resource held by younger -> WOUND
    const woundDecision = EosDeadlockDetectionGovernor.evaluateWoundWait(olderTx, youngerTx);
    assert.equal(woundDecision.decision, "WOUND");
    assert.equal(woundDecision.requestingTx, "tx-old");

    // Younger requests resource held by older -> WAIT
    const waitDecision = EosDeadlockDetectionGovernor.evaluateWoundWait(youngerTx, olderTx);
    assert.equal(waitDecision.decision, "WAIT");
    assert.equal(waitDecision.requestingTx, "tx-young");

    // Compare with Wait-Die: Younger requests lock held by older -> DIE
    const dieDecision = EosDeadlockDetectionGovernor.evaluateWaitDie(youngerTx, olderTx);
    assert.equal(dieDecision.decision, "DIE");
  });

  it("BDD-1490: Deadlock Audit Evidence Receipt Emission", () => {
    const graph = EosDeadlockDetectionGovernor.buildWfg(sampleWfg.transactions);
    const report = EosDeadlockDetectionGovernor.detectDeadlocks(graph);
    const receipt = EosDeadlockDetectionGovernor.generateReceipt(report, RECEIPT_PATH);

    assert.ok(fs.existsSync(RECEIPT_PATH));
    assert.equal(receipt.hasDeadlock, true);
    assert.equal(receipt.cyclesCount, 1);
    assert.equal(receipt.victimsCount, 1);
    assert.equal(typeof receipt.sha256Signature, "string");
    assert.equal(receipt.sha256Signature.length, 64);
  });
});
