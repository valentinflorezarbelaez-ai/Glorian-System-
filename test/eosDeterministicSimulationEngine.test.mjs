/**
 * BDD-1509..BDD-1514: FoundationDB / Antithesis-Style DST Engine Test Suite
 *
 * Validates virtual clock progression, deterministic pseudo-random entropy,
 * synthetic network chaos injection (drops, jitter, partitions), continuous
 * invariant assertion gates, 100% bit-by-bit trace reproducibility, and
 * cryptographic audit receipts.
 *
 * Conforms to SPEC-289 / CHANGE-151 and Law V.
 */

import * as assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import { DstPrng, EosDeterministicSimulationEngine } from "../src/core/eosDeterministicSimulationEngine.ts";

test("BDD-1509: Virtual Clock Progression and Event Scheduling", async () => {
  const engine = new EosDeterministicSimulationEngine({ seed: 42 });

  const executionOrder = [];
  engine.schedule(
    10,
    () => {
      executionOrder.push({ time: engine.now(), name: "event-10ms" });
    },
    "event-10ms",
  );

  engine.schedule(
    5,
    () => {
      executionOrder.push({ time: engine.now(), name: "event-5ms" });
    },
    "event-5ms",
  );

  engine.schedule(
    25,
    () => {
      executionOrder.push({ time: engine.now(), name: "event-25ms" });
    },
    "event-25ms",
  );

  const report = await engine.run();
  assert.equal(report.status, "COMPLETED");
  assert.equal(report.virtualTimeElapsedMs, 25);
  assert.equal(executionOrder.length, 3);
  assert.equal(executionOrder[0].name, "event-5ms");
  assert.equal(executionOrder[0].time, 5);
  assert.equal(executionOrder[1].name, "event-10ms");
  assert.equal(executionOrder[1].time, 10);
  assert.equal(executionOrder[2].name, "event-25ms");
  assert.equal(executionOrder[2].time, 25);
});

test("BDD-1510: Deterministic Entropy and Pseudo-Random Generation", () => {
  const prng1 = new DstPrng(1337);
  const prng2 = new DstPrng(1337);

  const floats1 = [];
  const floats2 = [];
  const ints1 = [];
  const ints2 = [];
  const uuids1 = [];
  const uuids2 = [];

  for (let i = 0; i < 1000; i++) {
    floats1.push(prng1.nextFloat());
    floats2.push(prng2.nextFloat());
    ints1.push(prng1.nextInt(1, 100000));
    ints2.push(prng2.nextInt(1, 100000));
    uuids1.push(prng1.deterministicUuid());
    uuids2.push(prng2.deterministicUuid());
  }

  assert.deepEqual(floats1, floats2);
  assert.deepEqual(ints1, ints2);
  assert.deepEqual(uuids1, uuids2);
});

test("BDD-1511: Synthetic Network Fault Injection and Partitioning", async () => {
  const engine = new EosDeterministicSimulationEngine({
    seed: 999,
    networkFaults: {
      dropRate: 0.0,
      jitterMinMs: 1,
      jitterMaxMs: 2,
    },
  });

  const received = { A: 0, B: 0, C: 0, D: 0 };
  engine.registerNode("A", () => {
    received.A++;
  });
  engine.registerNode("B", () => {
    received.B++;
  });
  engine.registerNode("C", () => {
    received.C++;
  });
  engine.registerNode("D", () => {
    received.D++;
  });

  // Partition cluster: [A, B] || [C, D]
  engine.setPartition(["A", "B"], ["C", "D"]);

  // Transmit cross-partition (A -> C)
  const sentCross = engine.send("A", "C", { payload: "cross" });
  assert.equal(sentCross, false);

  // Transmit within-partition (A -> B)
  const sentWithin = engine.send("A", "B", { payload: "within" });
  assert.equal(sentWithin, true);

  await engine.run();
  assert.equal(received.C, 0); // Blocked by partition
  assert.equal(received.B, 1); // Delivered within partition
});

test("BDD-1512: Continuous Invariant Evaluation and Violation Localization", async () => {
  const engine = new EosDeterministicSimulationEngine({ seed: 777 });

  let balance = 100;
  engine.addInvariant("NoBalanceBelowZero", () => {
    return balance >= 0;
  });

  engine.schedule(
    5,
    () => {
      balance -= 30; // 70
    },
    "WITHDRAW_VALID",
  );

  engine.schedule(
    10,
    () => {
      balance -= 80; // -10 (Breaches invariant!)
    },
    "WITHDRAW_EXCESSIVE",
  );

  engine.schedule(
    20,
    () => {
      balance += 50;
    },
    "DEPOSIT_LATER",
  );

  const report = await engine.run();
  assert.equal(report.status, "INVARIANT_BREACH");
  assert.ok(report.breachedInvariant);
  assert.equal(report.breachedInvariant.name, "NoBalanceBelowZero");
  assert.equal(report.breachedInvariant.step, 2);
  assert.equal(report.breachedInvariant.timeMs, 10);
});

test("BDD-1513: 100% Bit-by-Bit Trace Reproducibility across Independent Runs", async () => {
  const runSimulation = async (seed) => {
    const engine = new EosDeterministicSimulationEngine({
      seed,
      networkFaults: {
        dropRate: 0.15,
        jitterMinMs: 2,
        jitterMaxMs: 12,
        duplicateRate: 0.05,
      },
    });

    const state = { n1: 0, n2: 0, n3: 0 };
    engine.registerNode("n1", () => {
      state.n1++;
    });
    engine.registerNode("n2", () => {
      state.n2++;
    });
    engine.registerNode("n3", () => {
      state.n3++;
    });

    for (let i = 0; i < 50; i++) {
      engine.schedule(
        i * 2,
        () => {
          engine.send("n1", "n2", { i });
          engine.send("n2", "n3", { i });
        },
        `TICK_${i}`,
      );
    }

    const report = await engine.run({ maxSteps: 150 });
    return { report, state };
  };

  const run1 = await runSimulation(849201);
  const run2 = await runSimulation(849201);

  assert.equal(run1.report.executionTraceHash, run2.report.executionTraceHash);
  assert.equal(run1.report.totalStepsExecuted, run2.report.totalStepsExecuted);
  assert.equal(run1.report.totalFaultsInjected, run2.report.totalFaultsInjected);
  assert.deepEqual(run1.state, run2.state);
});

test("BDD-1514: Cryptographic Simulation Audit Receipt Verification", async () => {
  const receipt = await EosDeterministicSimulationEngine.auditSimulation(42);

  assert.ok(receipt.timestampIso);
  assert.equal(receipt.seed, 42);
  assert.equal(receipt.status, "COMPLETED");
  assert.ok(receipt.totalStepsExecuted > 0);
  assert.ok(receipt.virtualTimeElapsedMs > 0);
  assert.equal(receipt.sha256Signature.length, 64);

  // Validate on-disk receipt
  const receiptPath = path.resolve(process.cwd(), "docs", "evidence", "DST_SIMULATION_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
  const diskReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));

  assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);

  // Verify SHA-256 computation
  const payload = {
    timestampIso: diskReceipt.timestampIso,
    seed: diskReceipt.seed,
    status: diskReceipt.status,
    totalStepsExecuted: diskReceipt.totalStepsExecuted,
    virtualTimeElapsedMs: diskReceipt.virtualTimeElapsedMs,
    totalEventsProcessed: diskReceipt.totalEventsProcessed,
    totalFaultsInjected: diskReceipt.totalFaultsInjected,
    executionTraceHash: diskReceipt.executionTraceHash,
  };
  const expectedSignature = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  assert.equal(diskReceipt.sha256Signature, expectedSignature);
});
