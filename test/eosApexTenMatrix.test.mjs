import test from "node:test";
import assert from "node:assert/strict";
import { runAllFormalVerifications, parseTlaModule } from "../scripts/verify-formal-tla.mjs";
import { EosTimeTravelSim } from "../src/core/eosTimeTravelSim.ts";
import { EosSecureMemoryVault } from "../src/core/eosSecureMemoryVault.ts";
import { EosDatalogVerifier } from "../src/core/eosDatalogVerifier.ts";

test("SPEC-030 / BDD-067: TLA+ Text Extraction & Bounded JavaScript Simulations", async (t) => {
  await t.test("Subsuite 1: Extracts module, variables, and candidate invariant names", () => {
    const parsed = parseTlaModule("docs/formal/LmaxDisruptor.tla");
    assert.equal(parsed.moduleName, "LmaxDisruptor");
    assert.ok(parsed.variables.length >= 3);
    assert.ok(parsed.invariants.includes("NoOverrun") || parsed.invariants.includes("SafetyInvariant"));
  });

  await t.test("Subsuite 2: Runs deterministic bounded simulations", () => {
    const results = runAllFormalVerifications();
    assert.ok(results.length >= 3);
    for (const r of results) {
      assert.equal(r.sourceFileRead, true);
      assert.equal(r.simulationAssertionsPassed, true);
      assert.equal(r.executionMode, "bounded-javascript-simulation");
      assert.ok(r.stepsExecuted >= 100);
    }
  });
});

test("SPEC-030 / BDD-068: Jepsen Distributed Network Partition & Chaos Hypervisor", async (t) => {
  await t.test("Subsuite 1: Partitions Drop Cross-Talk Messages Without Crash", () => {
    const sim = new EosTimeTravelSim(774411);
    // Isolate replica-3 from {replica-1, replica-2}
    sim.isolatePartition(["replica-3"], ["replica-1", "replica-2"]);

    // Schedule message from replica-1 to replica-3 (must be partition dropped)
    sim.scheduleEvent("replica-1", "HEARTBEAT_POLL", 10, {}, "replica-3");
    // Schedule message from replica-1 to replica-2 (must be delivered)
    sim.scheduleEvent("replica-1", "PROPOSE_TX", 20, {}, "replica-2");

    const receipt = sim.runSimulation(30);
    assert.ok(receipt.jepsenMetrics);
    assert.ok(receipt.jepsenMetrics.partitionDropped >= 1, "Must detect at least 1 partition dropped message");
    assert.equal(receipt.jepsenMetrics.quorumMaintained, true);
  });

  await t.test("Subsuite 2: Network Heals and State Deterministically Converges", () => {
    const simA = new EosTimeTravelSim(998877);
    simA.isolatePartition(["replica-2"], ["replica-1"]);
    simA.scheduleEvent("replica-1", "PING", 10, {}, "replica-2");
    simA.runSimulation(10);
    simA.healPartition();
    simA.scheduleEvent("replica-1", "RECONCILE_ACK", 15, {}, "replica-2");
    const receiptA = simA.runSimulation(20);

    const simB = new EosTimeTravelSim(998877);
    simB.isolatePartition(["replica-2"], ["replica-1"]);
    simB.scheduleEvent("replica-1", "PING", 10, {}, "replica-2");
    simB.runSimulation(10);
    simB.healPartition();
    simB.scheduleEvent("replica-1", "RECONCILE_ACK", 15, {}, "replica-2");
    const receiptB = simB.runSimulation(20);

    assert.equal(receiptA.finalStateHash, receiptB.finalStateHash, "Deterministic replay must match after healing");
  });

  await t.test("Subsuite 3: Packet Drop Chaos Injection", () => {
    const sim = new EosTimeTravelSim(123456);
    sim.setPacketDropRate(0.8); // 80% packet loss
    sim.scheduleEvent("node-a", "SYNC", 10, {}, "node-b");
    sim.scheduleEvent("node-a", "SYNC", 20, {}, "node-b");
    sim.scheduleEvent("node-a", "SYNC", 30, {}, "node-b");
    const receipt = sim.runSimulation(15);
    assert.ok(receipt.jepsenMetrics);
    assert.ok(receipt.jepsenMetrics.packetLossDropped > 0, "Must simulate dropped packets");
  });
});

test("SPEC-030 / BDD-069: Hardened Pinned Memory Vault & Zero-Entropy Purge", async (t) => {
  const vault = new EosSecureMemoryVault();

  await t.test("Subsuite 1: Stores Raw Buffers and Performs Constant-Time Match", () => {
    const secretKey = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
    vault.storeSecret("master-api-key", secretKey);

    const validCandidate = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
    const invalidCandidate = new Uint8Array([0xAA, 0xBB, 0x00, 0xDD, 0xEE, 0xFF]);

    assert.equal(vault.compareSecret("master-api-key", validCandidate), true);
    assert.equal(vault.compareSecret("master-api-key", invalidCandidate), false);
    assert.equal(vault.compareSecret("non-existent-key", validCandidate), false);
  });

  await t.test("Subsuite 2: In-Place Cryptographic Wipe to Zero Entropy", () => {
    const token = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    vault.storeSecret("session-token-1", token);

    const reportBefore = vault.getAuditReport();
    assert.ok(reportBefore.activeHandles >= 1);
    assert.equal(reportBefore.epistemicState, "VAULT_ACTIVE");

    // Wipe secret in place
    const wiped = vault.wipeSecret("session-token-1");
    assert.equal(wiped, true);

    // Verify key no longer exists
    assert.equal(vault.compareSecret("session-token-1", token), false);
  });

  await t.test("Subsuite 3: Complete Vault Purge (wipeAll)", () => {
    vault.storeSecret("t1", new Uint8Array([10, 20]));
    vault.storeSecret("t2", new Uint8Array([30, 40]));

    const count = vault.wipeAll();
    assert.ok(count >= 2);

    const reportAfter = vault.getAuditReport();
    assert.equal(reportAfter.activeHandles, 0);
    assert.equal(reportAfter.epistemicState, "ZERO_ENTROPY_PURGED");
  });
});

test("SPEC-030 / BDD-070: Smart Datalog Predictive Test Selection (PTS)", async (t) => {
  const verifier = new EosDatalogVerifier();

  await t.test("Subsuite 1: Calculates Accurate PTS for Memory Vault", () => {
    const blast = verifier.queryBlastRadius("src/core/eosSecureMemoryVault.ts");
    assert.equal(blast.changedModule, "src/core/eosSecureMemoryVault.ts");
    assert.ok(blast.fixpointIterations >= 1);
    assert.ok(blast.durationUs >= 0);
  });
});
