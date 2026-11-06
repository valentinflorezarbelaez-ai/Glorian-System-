import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosInvariantVerificationEngine,
  Xorshift32Prng
} from "../src/core/eosInvariantVerificationEngine.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-155: Deterministic Exploration Reproducibility with Xorshift32 Seed", () => {
  const model = {
    name: "DeterministicCounter",
    initialState: { counter: 0 },
    actions: [
      { name: "step_add", apply: (s, prng) => ({ counter: s.counter + prng.nextInt(1, 5) }) },
      { name: "step_sub", apply: (s, prng) => ({ counter: s.counter - prng.nextInt(0, 2) }) }
    ],
    invariants: [
      { name: "always_numeric", check: (s) => typeof s.counter === "number" && !isNaN(s.counter) }
    ]
  };

  const run1 = EosInvariantVerificationEngine.verifyModel(model, { seed: 1337, maxSteps: 1000 });
  const run2 = EosInvariantVerificationEngine.verifyModel(model, { seed: 1337, maxSteps: 1000 });

  assert.equal(run1.status, "VERIFIED");
  assert.equal(run2.status, "VERIFIED");
  assert.equal(run1.stateHashChain, run2.stateHashChain);
  assert.deepEqual(run1.finalState, run2.finalState);
  assert.equal(run1.exploredStates, 1000);
});

test("BDD-156: Invariant Violation Detection with Immediate Abort", () => {
  const buggyModel = {
    name: "BuggyAccount",
    initialState: { balance: 50 },
    actions: [
      { name: "deposit", apply: (s) => ({ balance: s.balance + 10 }) },
      { name: "unbounded_withdraw", apply: (s) => ({ balance: s.balance - 25 }) }
    ],
    invariants: [
      { name: "non_negative_balance", check: (s) => s.balance >= 0 }
    ]
  };

  const result = EosInvariantVerificationEngine.verifyModel(buggyModel, { seed: 42, maxSteps: 100 });

  assert.equal(result.status, "INVARIANT_VIOLATION_DETECTED");
  assert.equal(result.failingInvariant, "non_negative_balance");
  assert.ok(result.violationState && result.violationState.balance < 0);
  assert.ok(result.stepOfViolation !== undefined && result.stepOfViolation > 0);
});

test("BDD-157: Fault Injection Hypervisor & Chaos Tolerance", () => {
  const model = {
    name: "ResilientHeartbeat",
    initialState: { state: "HEALTHY" },
    actions: [
      { name: "pulse", apply: (s) => ({ state: "HEALTHY" }) }
    ],
    invariants: [
      { name: "is_valid", check: (s) => s.state === "HEALTHY" }
    ]
  };

  const result = EosInvariantVerificationEngine.verifyModel(model, {
    seed: 9999,
    maxSteps: 500,
    faultInjectionRate: 0.15
  });

  assert.equal(result.status, "FAULT_TOLERANT_PASS");
  assert.ok(result.faultsInjected > 0, "Expected > 0 faults injected");
  assert.equal(result.stateHashChain.length, 64);
});

test("BDD-158: Minimal Reproducible Trace Shrinking", () => {
  const model = {
    name: "ShrinkableAccount",
    initialState: { balance: 100, transactions: 0 },
    actions: [
      { name: "noop_audit", apply: (s) => ({ ...s, transactions: s.transactions + 1 }) },
      { name: "small_deposit", apply: (s) => ({ balance: s.balance + 1, transactions: s.transactions + 1 }) },
      { name: "large_withdraw", apply: (s) => ({ balance: s.balance - 70, transactions: s.transactions + 1 }) }
    ],
    invariants: [
      { name: "no_overdraft", check: (s) => s.balance >= 0 }
    ]
  };

  const result = EosInvariantVerificationEngine.verifyModel(model, {
    seed: 7,
    maxSteps: 100,
    enableShrinking: true
  });

  assert.equal(result.status, "INVARIANT_VIOLATION_DETECTED");
  assert.ok(result.originalTraceLength && result.originalTraceLength > 2);
  assert.ok(result.shrunkTrace);
  assert.ok(
    result.shrunkTrace.length < result.originalTraceLength,
    `Shrunk trace (${result.shrunkTrace.length}) must be shorter than original (${result.originalTraceLength})`
  );

  // Verify that replaying the shrunk trace independently reproduces the violation
  const reproduces = EosInvariantVerificationEngine.replayActionTrace(
    model,
    result.shrunkTrace,
    "no_overdraft",
    7
  );
  assert.equal(reproduces, true, "Shrunk trace must reproduce the violation deterministically");
});

test("BDD-159: Cryptographic State Hash Chain & SQLite WAL Attestation", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-invariant-ledger-"));
  const ledgerDbPath = path.join(tmpDir, "invariant_ledger.sqlite");

  try {
    const model = {
      name: "AttestedSequence",
      initialState: { val: 1 },
      actions: [
        { name: "multiply", apply: (s) => ({ val: (s.val * 2) % 1000 }) }
      ],
      invariants: [
        { name: "positive", check: (s) => s.val >= 0 }
      ]
    };

    const res = EosInvariantVerificationEngine.verifyModel(model, {
      seed: 888,
      maxSteps: 50,
      ledgerDbPath,
      projectId: "eos-system"
    });

    assert.equal(res.status, "VERIFIED");
    assert.ok(res.ledgerEntryId && res.ledgerEntryId.startsWith("EOS-LEDGER-"));

    const ledger = new EosDurableSqliteLedger(ledgerDbPath);
    try {
      const integrity = ledger.verifyChainIntegrity();
      assert.equal(integrity.intact, true);
      assert.equal(integrity.totalEntries, 1);
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-160: MCP Dispatch of eos_invariant_engine", () => {
  const server = new EosMcpServer(projectRoot, "full");

  // 1. Verify existence in tools/list
  const listRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = listRes?.result?.tools || [];
  const invTool = tools.find((t) => t.name === "eos_invariant_engine");
  assert.ok(invTool, "eos_invariant_engine must be present in full profile");

  // 2. Explore transfer model via MCP
  const exploreRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_invariant_engine",
      arguments: {
        action: "explore",
        model: "transfer",
        seed: 42,
        maxSteps: 200
      }
    }
  });

  assert.ok(!exploreRes.error);
  const data = JSON.parse(exploreRes.result.content[0].text);
  assert.equal(data.status, "VERIFIED");
  assert.equal(data.modelName, "TransferLedger");
  assert.equal(data.exploredStates, 200);
  assert.equal(data.stateHashChain.length, 64);
});
