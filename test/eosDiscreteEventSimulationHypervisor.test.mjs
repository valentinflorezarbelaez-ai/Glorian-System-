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

  await t.test("BDD-1784B: Mutation-Hardening PRNG Seeds, Monotonicity, Bounding & Fault Predicates", () => {
    // 1. Default seed, default node role/status/offset, initial counters, 16-char runId slice
    const def = new EosDiscreteEventSimulationHypervisorCore();
    assert.strictEqual(def.getSeed(), "eos-desh-sovereign-seed-42");
    const initAudit = def.audit();
    assert.strictEqual(initAudit.runId, "desh-run-eos-desh-soverei-step0");
    assert.strictEqual(initAudit.faultsInjected, 0);
    assert.strictEqual(initAudit.invariantsEvaluated, 0);
    assert.strictEqual(initAudit.violationsCount, 0);

    const defNode = def.registerNode("n-def");
    assert.strictEqual(defNode.role, "WORKER");
    assert.strictEqual(defNode.status, "RUNNING");
    assert.strictEqual(defNode.clockOffsetNs, 0);

    const evDef = def.sendEvent("n-def", "n-def", "PING", {});
    assert.strictEqual(evDef.id, "ev-n-def-n-def-1");
    assert.strictEqual(evDef.sequenceId, 2);
    assert.strictEqual(evDef.scheduledTimeNs, 0);
    assert.strictEqual(evDef.priority, 2);

    // 2. Single-character string seeds and numeric 0 vs 1 SplitMix64 seed distinction
    const sA = new EosDiscreteEventSimulationHypervisorCore({ seed: "A" });
    const sB = new EosDiscreteEventSimulationHypervisorCore({ seed: "B" });
    sA.registerNode("x", "N");
    sA.registerNode("y", "N");
    sB.registerNode("x", "N");
    sB.registerNode("y", "N");
    sA.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });
    sB.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });
    for (let i = 1; i <= 15; i++) {
      sA.sendEvent("x", "y", "M", {}, i);
      sB.sendEvent("x", "y", "M", {}, i);
    }
    sA.runAll();
    sB.runAll();
    assert.notStrictEqual(sA.audit().auditHash, sB.audit().auditHash);

    const sZero = new EosDiscreteEventSimulationHypervisorCore({ seed: 0 });
    const sOne = new EosDiscreteEventSimulationHypervisorCore({ seed: 1 });
    const seq0 = [];
    const seq1 = [];
    sZero.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });
    sOne.addFaultRule({ type: "PACKET_DROP", probability: 0.5, active: true });
    for (let i = 1; i <= 12; i++) {
      sZero.sendEvent("a", "b", "M", {}, i);
      sOne.sendEvent("a", "b", "M", {}, i);
      seq0.push(sZero.step().faultApplied ?? "OK");
      seq1.push(sOne.step().faultApplied ?? "OK");
    }
    assert.notDeepStrictEqual(seq0, seq1);

    // 3. Virtual clock equal timestamp (allowed) vs past timestamp (monotonicity violation)
    const mono = new EosDiscreteEventSimulationHypervisorCore({ seed: "mono-test" });
    mono.registerNode("m", "N", { eventCount: 0 });
    mono.sendEvent("m", "m", "T100", {}, 100);
    mono.step();
    mono.scheduleEvent({
      id: "eq-ts",
      scheduledTimeNs: 100,
      priority: 1,
      sourceNodeId: "m",
      targetNodeId: "m",
      eventType: "EQ",
      payload: null,
    });
    assert.strictEqual(mono.audit().virtualTimeMonotonicity, true);
    const eqStep = mono.step();
    assert.strictEqual(eqStep.stepped, true);
    assert.strictEqual(eqStep.invariantViolation, undefined);
    assert.strictEqual(mono.getNode("m").customState.eventCount, 2);

    mono.scheduleEvent({
      id: "past-ts",
      scheduledTimeNs: 50,
      priority: 1,
      sourceNodeId: "m",
      targetNodeId: "m",
      eventType: "PAST",
      payload: null,
    });
    assert.strictEqual(mono.audit().virtualTimeMonotonicity, false);
    const pastStep = mono.step();
    assert.strictEqual(pastStep.stepped, true);
    assert.ok(
      pastStep.invariantViolation.includes("Monotonicity violated") && pastStep.invariantViolation.includes("< clock"),
    );

    // 4. Default faultId, setPartition reverse direction, runUntil/runAll maxSteps & loop bounds
    const fSim = new EosDiscreteEventSimulationHypervisorCore({ seed: "fault-bounds" });
    fSim.registerNode("s1", "N");
    fSim.registerNode("s2", "N");
    fSim.registerNode("t1", "N", { eventCount: "not-a-number" });
    const autoFault = fSim.addFaultRule({
      type: "PACKET_DROP",
      probability: 1.0,
      sourceNodeId: "s1",
      targetNodeId: "t1",
      active: true,
    });
    assert.strictEqual(autoFault.faultId, "fault-1");
    const autoPart = fSim.setPartition(["pA"], ["pB"]);
    assert.strictEqual(autoPart.faultId, "partition-rule");

    fSim.registerNode("pA", "N");
    fSim.registerNode("pB", "N");
    fSim.sendEvent("pB", "pA", "REV_PART", {}, 10);
    assert.strictEqual(fSim.step().faultApplied, "PACKET_DROP");
    fSim.removeFaultRule("partition-rule");

    // Source matches only (t1 -> t2), Target matches only (s2 -> t1), both match (s1 -> t1)
    fSim.sendEvent("s1", "s2", "SRC_ONLY", {}, 20);
    assert.strictEqual(fSim.step().faultApplied, undefined);
    fSim.sendEvent("s2", "t1", "TGT_ONLY", {}, 30);
    assert.strictEqual(fSim.step().faultApplied, undefined);
    assert.strictEqual(fSim.getNode("t1").customState.eventCount, "not-a-number");
    fSim.sendEvent("s1", "t1", "BOTH_MATCH", {}, 40);
    assert.strictEqual(fSim.step().faultApplied, "PACKET_DROP");
    fSim.removeFaultRule("fault-1");

    // Corruption with null payload must not throw or mutate non-object
    fSim.addFaultRule({ type: "PACKET_CORRUPTION", probability: 1.0, targetNodeId: "t1", active: true });
    fSim.sendEvent("s1", "t1", "NULL_PL", null, 50);
    const nullStep = fSim.step();
    assert.strictEqual(nullStep.faultApplied, "PACKET_CORRUPTION");
    assert.strictEqual(fSim.getNode("t1").inbox.at(-1).payload, null);

    // Crashed node clears inbox on crash and ignores subsequent deliveries
    fSim.addFaultRule({ type: "NODE_CRASH", probability: 1.0, targetNodeId: "s2", active: true });
    assert.strictEqual(fSim.getNode("s2").inbox.length, 1);
    fSim.sendEvent("s1", "s2", "CRASH_NOW", {}, 60);
    fSim.step();
    assert.strictEqual(fSim.getNode("s2").inbox.length, 0);
    fSim.sendEvent("s1", "s2", "AFTER_CRASH", {}, 70);
    fSim.step();
    assert.strictEqual(fSim.getNode("s2").inbox.length, 0);

    // runUntil / runAll maxSteps bounds & stop-at-targetVirtualTimeNs
    const loopSim = new EosDiscreteEventSimulationHypervisorCore({ seed: "loops" });
    loopSim.registerNode("a", "N");
    loopSim.sendEvent("a", "a", "E1", {}, 10);
    loopSim.sendEvent("a", "a", "E2", {}, 20);
    loopSim.sendEvent("a", "a", "E3", {}, 30);
    assert.strictEqual(loopSim.runUntil(20, 0).length, 0);
    assert.strictEqual(loopSim.runUntil(20, 1).length, 1);
    assert.strictEqual(loopSim.runUntil(20, 5).length, 1);
    assert.strictEqual(loopSim.getQueueLength(), 1);

    loopSim.sendEvent("a", "a", "E4", {}, 40);
    assert.strictEqual(loopSim.runAll(0).length, 0);
    assert.strictEqual(loopSim.runAll(1).length, 1);
    assert.strictEqual(loopSim.runAll().length, 1);

    // Rollback missing checkpoint and tampered checkpoint hash
    assert.strictEqual(loopSim.rollback("does-not-exist"), false);
    const cp = loopSim.createCheckpoint("tamper-cp");
    loopSim.checkpoints.set("tamper-cp", { ...cp, stateHash: "0".repeat(64) });
    assert.strictEqual(loopSim.rollback("tamper-cp"), false);
    assert.strictEqual(loopSim.audit().snapshotConsistency, false);
  });
});
