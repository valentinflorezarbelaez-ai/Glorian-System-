/**
 * @file eosBitemporalEventSourcingLedger.test.mjs
 * @description Automated test suite for SPEC-357 / CHANGE-219: Autonomous Bitemporal Dynamic State Machine & Event Sourcing Hyper-Ledger.
 *
 * Verifies BDD-1921 through BDD-1926:
 * - BDD-1921: Immutable Bitemporal Datom Ingestion & Monotonic Clock
 * - BDD-1922: Non-Destructive Retraction & Fact Supersession
 * - BDD-1923: 2D As-Of Bitemporal Time-Travel State Reconstruction
 * - BDD-1924: LIDR Agentic Engineering SDLC Lifecycle Event Audit
 * - BDD-1925: Cryptographic Merkle Root Verification of Event Integrity
 * - BDD-1926: High-Throughput Event Ingestion Benchmark & Formal Audit Receipt
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosBitemporalDatomStore,
  EosBitemporalLedgerCore,
  EosBitemporalProjectionEngine,
  EosMerkleTree,
} from "../src/core/eosBitemporalEventSourcingLedger.ts";

test("BDD-1921: Immutable Bitemporal Datom Ingestion & Monotonic Clock", () => {
  const store = new EosBitemporalDatomStore();

  assert.equal(store.getCurrentTx(), 0);
  assert.equal(store.getBlocks().length, 1); // Genesis block
  assert.equal(store.getBlocks()[0].blockIndex, 0);

  const block1 = store.append([
    {
      entityId: "spec:SPEC-357",
      attribute: "status",
      value: "DRAFT",
      validFrom: 1000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  assert.equal(store.getCurrentTx(), 1);
  assert.equal(block1.blockIndex, 1);
  assert.equal(block1.datoms.length, 1);
  assert.equal(block1.datoms[0].txTime, 1);
  assert.equal(block1.previousHash, store.getBlocks()[0].blockHash);

  const block2 = store.append([
    {
      entityId: "spec:SPEC-357",
      attribute: "version",
      value: "1.0.0",
      validFrom: 1100,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  assert.equal(store.getCurrentTx(), 2);
  assert.equal(block2.blockIndex, 2);
  assert.equal(block2.previousHash, block1.blockHash);
  assert.ok(block2.blockHash.length === 64);
});

test("BDD-1922: Non-Destructive Retraction & Fact Supersession", () => {
  const store = new EosBitemporalDatomStore();

  // Assert fact at Tx 1
  store.append([
    {
      entityId: "spec:SPEC-357",
      attribute: "owner",
      value: "agent-alpha",
      validFrom: 1000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  // Retract fact at Tx 2 (non-destructively)
  store.append([
    {
      entityId: "spec:SPEC-357",
      attribute: "owner",
      value: "agent-alpha",
      validFrom: 1000,
      validTo: 2000,
      op: "RETRACT",
    },
    {
      entityId: "spec:SPEC-357",
      attribute: "owner",
      value: "agent-beta",
      validFrom: 2000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  // Historical datoms remain untouched (append-only log)
  const allDatoms = store.getAllDatoms();
  assert.equal(allDatoms.length, 3);
  assert.equal(allDatoms[0].op, "ASSERT");
  assert.equal(allDatoms[0].value, "agent-alpha");
  assert.equal(allDatoms[1].op, "RETRACT");
  assert.equal(allDatoms[2].op, "ASSERT");
  assert.equal(allDatoms[2].value, "agent-beta");
});

test("BDD-1923: 2D As-Of Bitemporal Time-Travel State Reconstruction", () => {
  const store = new EosBitemporalDatomStore();

  // Tx 1: validFrom 1000
  store.append([
    {
      entityId: "task:TASK-219",
      attribute: "status",
      value: "PENDING",
      validFrom: 1000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  // Tx 2: validFrom 2000
  store.append([
    {
      entityId: "task:TASK-219",
      attribute: "status",
      value: "IN_PROGRESS",
      validFrom: 2000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  // Tx 3: validFrom 3000
  store.append([
    {
      entityId: "task:TASK-219",
      attribute: "status",
      value: "DONE",
      validFrom: 3000,
      validTo: Number.MAX_SAFE_INTEGER,
      op: "ASSERT",
    },
  ]);

  const datoms = store.getAllDatoms();

  // Query as of Tx 1: Only Tx 1 is known
  const stateTx1 = EosBitemporalProjectionEngine.projectEntity(datoms, {
    entityId: "task:TASK-219",
    asOfTx: 1,
    asOfValid: 1500,
  });
  assert.equal(stateTx1.status, "PENDING");

  // Query as of Tx 2, valid 2500
  const stateTx2 = EosBitemporalProjectionEngine.projectEntity(datoms, {
    entityId: "task:TASK-219",
    asOfTx: 2,
    asOfValid: 2500,
  });
  assert.equal(stateTx2.status, "IN_PROGRESS");

  // Query as of Tx 3, valid 3500
  const stateTx3 = EosBitemporalProjectionEngine.projectEntity(datoms, {
    entityId: "task:TASK-219",
    asOfTx: 3,
    asOfValid: 3500,
  });
  assert.equal(stateTx3.status, "DONE");

  // Query as of Tx 3 but back in valid time (valid 1500)
  const stateHistoricalValid = EosBitemporalProjectionEngine.projectEntity(datoms, {
    entityId: "task:TASK-219",
    asOfTx: 3,
    asOfValid: 1500,
  });
  // At valid time 1500, Tx 2 (validFrom 2000) and Tx 3 (validFrom 3000) were not yet in effect;
  // thus the status at valid time 1500 is PENDING.
  assert.equal(stateHistoricalValid.status, "PENDING");
});

test("BDD-1924: LIDR Agentic Engineering SDLC Lifecycle Event Audit", () => {
  const ledger = new EosBitemporalLedgerCore();
  const t0 = 1000000;

  ledger.recordLidrEvent(
    "SPEC_PROPOSED",
    {
      specId: "SPEC-357",
      agentId: "agentic-engineer",
      phase: "INTAKE",
      details: { title: "Bitemporal Ledger", author: "Alvaro Moya LIDR" },
    },
    t0,
  );

  ledger.recordLidrEvent(
    "SPEC_APPROVED",
    {
      specId: "SPEC-357",
      agentId: "architect-gatekeeper",
      phase: "SPEC_APPROVED",
      details: { level: 3, authorizationId: "AUTH-2026-11-19-BITEMPORAL-EVENT-SOURCING-LEDGER" },
    },
    t0 + 1000,
  );

  ledger.recordLidrEvent(
    "TASK_CLAIMED",
    {
      specId: "SPEC-357",
      agentId: "subagent-coder-1",
      phase: "IMPLEMENTATION",
      details: { taskId: "TASK-219-01" },
    },
    t0 + 2000,
  );

  ledger.recordLidrEvent(
    "CODE_APPLIED",
    {
      specId: "SPEC-357",
      agentId: "subagent-coder-1",
      phase: "IMPLEMENTATION",
      details: { filesModified: ["src/core/eosBitemporalEventSourcingLedger.ts"] },
    },
    t0 + 3000,
  );

  ledger.recordLidrEvent(
    "GATE_SEALED",
    {
      specId: "SPEC-357",
      agentId: "evidence-auditor",
      phase: "VERIFY",
      details: { tlcModel: 100, verdict: "CONFORMANT" },
    },
    t0 + 4000,
  );

  const blocks = ledger.getStore().getBlocks();
  assert.equal(blocks.length, 6); // Genesis + 5 events
  assert.ok(ledger.getStore().verifyIntegrity());

  // Query entity state
  const finalState = ledger.queryAsOf({ entityId: "spec:SPEC-357" });
  assert.equal(finalState.lastEventType, "GATE_SEALED");
  assert.equal(finalState.phase, "VERIFY");
  assert.equal(finalState.lastAgentId, "evidence-auditor");
});

test("BDD-1925: Cryptographic Merkle Root Verification of Event Integrity", () => {
  const store = new EosBitemporalDatomStore();

  // Empty Merkle root
  const rootEmpty = EosMerkleTree.computeRoot([]);
  assert.ok(typeof rootEmpty === "string" && rootEmpty.length === 64);

  // Single datom root
  const d1 = {
    entityId: "e1",
    attribute: "a1",
    value: 42,
    validFrom: 1,
    validTo: 100,
    txTime: 1,
    op: "ASSERT",
  };
  const root1 = EosMerkleTree.computeRoot([d1]);
  assert.ok(root1.length === 64);

  // Multi-datom root deterministic
  const d2 = {
    entityId: "e2",
    attribute: "a2",
    value: "test",
    validFrom: 2,
    validTo: 100,
    txTime: 1,
    op: "ASSERT",
  };
  const root2a = EosMerkleTree.computeRoot([d1, d2]);
  const root2b = EosMerkleTree.computeRoot([d1, d2]);
  assert.equal(root2a, root2b);

  // Append blocks and verify integrity
  store.append([d1]);
  store.append([d2]);
  assert.ok(store.verifyIntegrity());
});

test("BDD-1926: High-Throughput Event Ingestion Benchmark & Formal Audit Receipt", () => {
  const bench = EosBitemporalLedgerCore.runBenchmark(2000);

  assert.equal(bench.transactionsAppended, 2000);
  assert.ok(bench.throughputTps > 1000);
  assert.ok(bench.merkleVerified);
  assert.ok(bench.avgQueryLatencyUs >= 0);

  const receipt = EosBitemporalLedgerCore.audit(process.cwd());
  assert.equal(receipt.specId, "SPEC-357");
  assert.equal(receipt.changeId, "CHANGE-219");
  assert.equal(receipt.verdict, "CONFORMANT");
  assert.equal(receipt.tlcModelVerified, true);
  assert.equal(receipt.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

  const receiptPath = resolveEvidencePath("BITEMPORAL_EVENT_SOURCING_LEDGER_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
});
