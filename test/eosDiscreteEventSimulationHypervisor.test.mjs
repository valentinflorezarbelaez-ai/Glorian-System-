/**
 * @file eosDiscreteEventSimulationHypervisor.test.mjs
 * @description BDD test suite for SPEC-334 / CHANGE-196: Deterministic Discrete-Event Simulation
 * Hypervisor & Time-Travel Fault Injection Engine (BDD-1779..1784).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EosDiscreteEventSimulationHypervisorCore } from "../src/core/eosDiscreteEventSimulationHypervisor.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/DESH_RECEIPT.json");

test("SPEC-334 / CHANGE-196: Deterministic Discrete-Event Simulation Hypervisor (DESH)", async (t) => {
  await t.test("BDD-1779: Virtual Nanosecond Monotonic Clock & Priority Event Queue Dispatch", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: 100 });
    hypervisor.registerNode("node-a", "SENDER");
    hypervisor.registerNode("node-b", "RECEIVER");

    // Schedule events in deliberately scrambled order
    hypervisor.sendEvent("node-a", "node-b", "EVENT_LATE", { seq: 3 }, 3000);
    hypervisor.sendEvent("node-a", "node-b", "EVENT_EARLY", { seq: 1 }, 1000);
    hypervisor.sendEvent("node-a", "node-b", "EVENT_MID", { seq: 2 }, 2000);

    assert.strictEqual(hypervisor.getQueueLength(), 3);
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 0);

    // Step 1: should dispatch EVENT_EARLY at 1000ns
    const step1 = hypervisor.step();
    assert.strictEqual(step1.stepped, true);
    assert.strictEqual(step1.event?.eventType, "EVENT_EARLY");
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 1000);

    // Step 2: should dispatch EVENT_MID at 2000ns
    const step2 = hypervisor.step();
    assert.strictEqual(step2.stepped, true);
    assert.strictEqual(step2.event?.eventType, "EVENT_MID");
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 2000);

    // Step 3: should dispatch EVENT_LATE at 3000ns
    const step3 = hypervisor.step();
    assert.strictEqual(step3.stepped, true);
    assert.strictEqual(step3.event?.eventType, "EVENT_LATE");
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 3000);

    // Queue now empty
    const step4 = hypervisor.step();
    assert.strictEqual(step4.stepped, false);
    assert.strictEqual(hypervisor.getQueueLength(), 0);
  });

  await t.test("BDD-1779: Priority & Sequence Ordering with Identical Virtual Timestamps", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: 200 });
    hypervisor.registerNode("node-1", "PRODUCER");

    // Events scheduled for the exact same nanosecond with different priorities (0 = CRITICAL, 3 = LOW)
    hypervisor.scheduleEvent({
      id: "ev-low",
      scheduledTimeNs: 5000,
      priority: 3,
      sourceNodeId: "node-1",
      targetNodeId: "node-1",
      eventType: "LOW_PRIORITY",
      payload: {},
    });

    hypervisor.scheduleEvent({
      id: "ev-crit",
      scheduledTimeNs: 5000,
      priority: 0,
      sourceNodeId: "node-1",
      targetNodeId: "node-1",
      eventType: "CRITICAL_PRIORITY",
      payload: {},
    });

    hypervisor.scheduleEvent({
      id: "ev-norm",
      scheduledTimeNs: 5000,
      priority: 2,
      sourceNodeId: "node-1",
      targetNodeId: "node-1",
      eventType: "NORMAL_PRIORITY",
      payload: {},
    });

    const s1 = hypervisor.step();
    assert.strictEqual(s1.event?.id, "ev-crit");

    const s2 = hypervisor.step();
    assert.strictEqual(s2.event?.id, "ev-norm");

    const s3 = hypervisor.step();
    assert.strictEqual(s3.event?.id, "ev-low");
  });

  await t.test("BDD-1780: 100% Bit-Exact Simulation Replayability via 64-bit PRNG Seed", () => {
    const seed = "sovereign-reproducibility-seed-999";

    function runSimulation(s) {
      const h = new EosDiscreteEventSimulationHypervisorCore({ seed: s });
      h.registerNode("leader", "COORDINATOR");
      h.registerNode("replica", "FOLLOWER");

      h.addFaultRule({
        type: "PACKET_DROP",
        probability: 0.5,
        sourceNodeId: "leader",
        targetNodeId: "replica",
        active: true,
      });

      for (let i = 1; i <= 20; i++) {
        h.sendEvent("leader", "replica", `MSG-${i}`, { num: i }, i * 100);
      }

      const results = h.runAll();
      const audit = h.audit();
      return { results, audit };
    }

    const simA = runSimulation(seed);
    const simB = runSimulation(seed);

    assert.strictEqual(simA.results.length, simB.results.length);
    assert.strictEqual(simA.audit.auditHash, simB.audit.auditHash);
    assert.strictEqual(simA.audit.eventsProcessed, simB.audit.eventsProcessed);
    assert.strictEqual(simA.audit.faultsInjected, simB.audit.faultsInjected);

    for (let i = 0; i < simA.results.length; i++) {
      assert.strictEqual(simA.results[i].faultApplied, simB.results[i].faultApplied);
      assert.strictEqual(simA.results[i].virtualTimeNs, simB.results[i].virtualTimeNs);
    }
  });

  await t.test("BDD-1780: Distinct Simulation Trajectories Under Different Seeds", () => {
    const h1 = new EosDiscreteEventSimulationHypervisorCore({ seed: "seed-alpha" });
    const h2 = new EosDiscreteEventSimulationHypervisorCore({ seed: "seed-beta" });

    h1.registerNode("a", "N");
    h1.registerNode("b", "N");
    h2.registerNode("a", "N");
    h2.registerNode("b", "N");

    h1.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });
    h2.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });

    for (let i = 1; i <= 30; i++) {
      h1.sendEvent("a", "b", "MSG", {}, i * 10);
      h2.sendEvent("a", "b", "MSG", {}, i * 10);
    }

    h1.runAll();
    h2.runAll();

    const audit1 = h1.audit();
    const audit2 = h2.audit();

    assert.notStrictEqual(audit1.auditHash, audit2.auditHash);
  });

  await t.test("BDD-1781: Intercepted Mesh Messaging, Node Virtualization & Inboxes", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "mesh-seed" });
    const n1 = hypervisor.registerNode("srv-auth", "AUTH_SERVICE", { authenticatedUsers: [] });
    hypervisor.registerNode("srv-gateway", "API_GATEWAY");

    hypervisor.sendEvent("srv-gateway", "srv-auth", "TOKEN_VERIFY", { user: "alice" }, 500);
    assert.strictEqual(n1.inbox.length, 0);

    hypervisor.runUntil(500);

    assert.strictEqual(n1.inbox.length, 1);
    assert.strictEqual(n1.inbox[0].eventType, "TOKEN_VERIFY");
    assert.deepStrictEqual(n1.inbox[0].payload, { user: "alice" });
  });

  await t.test("BDD-1782: Byzantine Fault Injection: Symmetric & Asymmetric Network Partitions", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "partition-seed" });
    const e1 = hypervisor.registerNode("east-1", "DC_EAST");
    const w1 = hypervisor.registerNode("west-1", "DC_WEST");

    // Partition east-1 from west-1
    hypervisor.setPartition(["east-1"], ["west-1"]);

    // Send packet across partition: east-1 -> west-1
    hypervisor.sendEvent("east-1", "west-1", "CROSS_SYNC", { data: 42 }, 100);
    const stepCross = hypervisor.step();

    assert.strictEqual(stepCross.faultApplied, "PACKET_DROP");
    assert.strictEqual(w1.inbox.length, 0); // Not delivered

    // Send packet within east partition: east-1 -> east-1 (local)
    hypervisor.sendEvent("east-1", "east-1", "LOCAL_HEARTBEAT", { ok: true }, 200);
    const stepLocal = hypervisor.step();

    assert.strictEqual(stepLocal.faultApplied, undefined);
    assert.strictEqual(e1.inbox.length, 1);
  });

  await t.test("BDD-1782: Byzantine Fault Injection: Packet Drops, Payload Bit-Corruptions & Node Crashes", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "chaos-seed" });
    hypervisor.registerNode("node-src", "SOURCE");
    const n2 = hypervisor.registerNode("node-dst", "TARGET");

    // 1. Bit-corruption rule
    const corruptRule = hypervisor.addFaultRule({
      type: "PACKET_CORRUPTION",
      probability: 1.0,
      targetNodeId: "node-dst",
      active: true,
    });

    hypervisor.sendEvent("node-src", "node-dst", "DATA", { checksum: "valid" }, 100);
    const s1 = hypervisor.step();
    assert.strictEqual(s1.faultApplied, "PACKET_CORRUPTION");
    assert.strictEqual(n2.inbox[0].payload._corrupted, true);

    // Remove corruption rule and test node crash rule
    hypervisor.removeFaultRule(corruptRule.faultId);

    // 2. Node crash rule
    hypervisor.addFaultRule({
      type: "NODE_CRASH",
      probability: 1.0,
      targetNodeId: "node-dst",
      active: true,
    });

    hypervisor.sendEvent("node-src", "node-dst", "PING_AFTER_CRASH", {}, 200);
    const s2 = hypervisor.step();
    assert.strictEqual(s2.faultApplied, "NODE_CRASH");
    assert.strictEqual(n2.status, "CRASHED");
  });

  await t.test("BDD-1783: Chandy-Lamport Global Checkpoint Snapshots & Time-Travel Rollback", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "timetravel-seed" });
    hypervisor.registerNode("coordinator", "RAFT_LEADER", { term: 1 });

    // Step A
    hypervisor.sendEvent("coordinator", "coordinator", "VOTE_REQ", { term: 1 }, 100);
    hypervisor.step();
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 100);

    // Capture Checkpoint 1
    const cp1 = hypervisor.createCheckpoint("chk-term-1");
    assert.strictEqual(cp1.virtualTimeNs, 100);
    assert.ok(cp1.stateHash.length === 64);

    // Step B and C: move forward
    hypervisor.sendEvent("coordinator", "coordinator", "APPEND_ENTRIES", { term: 2 }, 500);
    hypervisor.step();
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 600);

    // Time-Travel Rollback to Checkpoint 1
    const rollbackSuccess = hypervisor.rollback("chk-term-1");
    assert.strictEqual(rollbackSuccess, true);
    assert.strictEqual(hypervisor.getVirtualTimeNs(), 100);

    // Verify hypervisor can branch alternative future from rollback point
    hypervisor.sendEvent("coordinator", "coordinator", "SPLIT_BRAIN_AVOIDED", { term: 1 }, 150);
    const branchStep = hypervisor.step();
    assert.strictEqual(branchStep.virtualTimeNs, 250);
    assert.strictEqual(branchStep.event?.eventType, "SPLIT_BRAIN_AVOIDED");
  });

  await t.test("BDD-1784: Continuous State Invariant Enforcement and Breach Detection", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "invariant-seed" });
    hypervisor.registerNode("counter-node", "WORKER", { count: 0 });

    // Invariant: virtual time must never exceed 10,000ns
    hypervisor.addInvariant({
      name: "MaxTimeUnder10k",
      check: (state) => state.virtualTimeNs <= 10000,
    });

    hypervisor.sendEvent("counter-node", "counter-node", "SAFE", {}, 1000);
    const s1 = hypervisor.step();
    assert.strictEqual(s1.invariantViolation, undefined);

    // Schedule event exceeding invariant threshold
    hypervisor.sendEvent("counter-node", "counter-node", "BREACH", {}, 15000);
    const s2 = hypervisor.step();
    assert.ok(s2.invariantViolation?.includes("MaxTimeUnder10k"));
  });

  await t.test("BDD-1784: Cryptographic Audit Receipt Verification (SHA-256 Digest & Properties)", () => {
    const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed: "audit-test-seed" });
    hypervisor.registerNode("node-x", "ROLE_X");
    hypervisor.registerNode("node-y", "ROLE_Y");

    hypervisor.sendEvent("node-x", "node-y", "TASK", {}, 100);
    hypervisor.step();
    hypervisor.createCheckpoint("cp-test");

    const receipt = hypervisor.audit();

    assert.ok(receipt.runId.startsWith("desh-run-"));
    assert.strictEqual(receipt.virtualTimeMonotonicity, true);
    assert.strictEqual(receipt.prngDeterminism, true);
    assert.strictEqual(receipt.snapshotConsistency, true);
    assert.strictEqual(receipt.eventsProcessed, 1);
    assert.strictEqual(receipt.checkpointsCreated, 1);
    assert.strictEqual(receipt.violationsCount, 0);
    assert.strictEqual(receipt.auditHash.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
