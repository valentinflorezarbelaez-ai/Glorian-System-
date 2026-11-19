/**
 * BDD Test Suite for SPEC-313 / CHANGE-175:
 * Jepsen-Grade Distributed Network Partition & Chaos Simulator
 *
 * Verifies BDD-1653..BDD-1658.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJepsenCluster, EosJepsenDistributedChaosCore } from "../src/core/index.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import { handleJepsenChaosCommand } from "../bin/commands/cliJepsenDistributedChaos.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("JEPSEN_DISTRIBUTED_CHAOS_RECEIPT.json", ROOT);

describe("SPEC-313: Jepsen-Grade Distributed Network Partition & Chaos Simulator", () => {
  // -------------------------------------------------------------------------
  // BDD-1653: Deterministic Topology Initialization & Seed Reproducibility
  // -------------------------------------------------------------------------
  it("BDD-1653: Deterministic topology initialization & seed reproducibility", () => {
    const cluster1 = createJepsenCluster(5, 42);
    const cluster2 = createJepsenCluster(5, 42);

    assert.equal(cluster1.getAllNodes().length, 5);
    assert.equal(cluster2.getAllNodes().length, 5);

    // Initial node state validation
    for (let i = 0; i < 5; i++) {
      const node = cluster1.getNode(`node-${i}`);
      assert.equal(node.nodeId, `node-${i}`);
      assert.equal(node.wallClockOffsetMs, 0);
      assert.equal(node.vectorClock[`node-${i}`], 0);
      assert.deepEqual(node.registerStore, {});
    }

    // Both clusters perform identical writes and should produce identical state
    cluster1.write("node-0", "k1", "v1");
    cluster2.write("node-0", "k1", "v1");

    cluster1.processPackets(10);
    cluster2.processPackets(10);

    const snapshot1 = cluster1.verifyConvergence();
    const snapshot2 = cluster2.verifyConvergence();

    assert.equal(snapshot1.stateHash, snapshot2.stateHash);
    assert.equal(snapshot1.converged, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1654: Symmetric Network Partition & Cross-Partition Isolation
  // -------------------------------------------------------------------------
  it("BDD-1654: Symmetric network partition & cross-partition isolation", () => {
    const cluster = createJepsenCluster(5, 100);

    cluster.injectPartition({
      type: "SYMMETRIC",
      subsets: [
        ["node-0", "node-1"],
        ["node-2", "node-3", "node-4"],
      ],
    });

    // Cross-partition delivery should be completely blocked
    assert.equal(cluster.canDeliver("node-0", "node-2"), false);
    assert.equal(cluster.canDeliver("node-2", "node-0"), false);
    assert.equal(cluster.canDeliver("node-1", "node-3"), false);

    // Intra-partition delivery must remain intact
    assert.equal(cluster.canDeliver("node-0", "node-1"), true);
    assert.equal(cluster.canDeliver("node-1", "node-0"), true);
    assert.equal(cluster.canDeliver("node-2", "node-3"), true);
    assert.equal(cluster.canDeliver("node-3", "node-4"), true);

    // Write in partition A should not reach partition B while partitioned
    cluster.write("node-0", "secret_A", "split_val_A");
    cluster.processPackets(50);

    assert.equal(cluster.getNode("node-1").registerStore.secret_A?.value, "split_val_A");
    assert.equal(cluster.getNode("node-2").registerStore.secret_A, undefined);
    assert.equal(cluster.getNode("node-3").registerStore.secret_A, undefined);
  });

  // -------------------------------------------------------------------------
  // BDD-1655: Asymmetric Network Partition (Directed Blackhole)
  // -------------------------------------------------------------------------
  it("BDD-1655: Asymmetric network partition (directed blackhole)", () => {
    const cluster = createJepsenCluster(3, 200);

    // Sever directed link node-0 -> node-1
    cluster.injectPartition({
      type: "ASYMMETRIC",
      severedLinks: [{ from: "node-0", to: "node-1" }],
    });

    // node-0 cannot send to node-1, but node-1 can send to node-0
    assert.equal(cluster.canDeliver("node-0", "node-1"), false);
    assert.equal(cluster.canDeliver("node-1", "node-0"), true);

    // Other links are unaffected
    assert.equal(cluster.canDeliver("node-0", "node-2"), true);
    assert.equal(cluster.canDeliver("node-1", "node-2"), true);
  });

  // -------------------------------------------------------------------------
  // BDD-1656: Probabilistic Packet Loss & Latency Jitter
  // -------------------------------------------------------------------------
  it("BDD-1656: Probabilistic packet loss & latency jitter", () => {
    const cluster = createJepsenCluster(4, 300, {
      packetLossRate: 0.5,
      defaultLatencyMs: 10,
      jitterMs: 5,
    });

    // Invalidate invalid loss rates
    assert.throws(() => cluster.injectPacketLoss(-0.1), /between 0.0 and 1.0/);
    assert.throws(() => cluster.injectPacketLoss(1.5), /between 0.0 and 1.0/);

    cluster.write("node-0", "loss_test", "payload_123");
    const processed = cluster.processPackets(100);

    assert.ok(processed > 0);
    const receipt = cluster.generateReceipt();
    assert.ok(receipt.totalPackets > 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1657: Partition Healing & Eventual Anti-Entropy Convergence
  // -------------------------------------------------------------------------
  it("BDD-1657: Partition healing & eventual anti-entropy convergence", () => {
    const cluster = createJepsenCluster(4, 400);

    // Create 2 partitions
    cluster.injectPartition({
      type: "SYMMETRIC",
      subsets: [
        ["node-0", "node-1"],
        ["node-2", "node-3"],
      ],
    });

    // Write conflicting keys in separate partitions
    cluster.write("node-0", "shared_resource", "version_A");
    cluster.write("node-2", "shared_resource", "version_B");
    cluster.processPackets(50);

    // Prior to healing, the partitions diverge
    const preHeal = cluster.verifyConvergence();
    assert.equal(preHeal.converged, false);
    assert.ok(preHeal.divergentNodes.length > 0);

    // Heal network and run anti-entropy gossip
    cluster.healCluster();
    cluster.runAntiEntropySync(5);

    // After healing and anti-entropy sync, all nodes must converge deterministically
    const postHeal = cluster.verifyConvergence();
    assert.equal(postHeal.converged, true);
    assert.equal(postHeal.divergentNodes.length, 0);

    // All nodes have the exact same value for shared_resource
    const finalValue = cluster.getNode("node-0").registerStore.shared_resource.value;
    for (let i = 1; i < 4; i++) {
      assert.equal(cluster.getNode(`node-${i}`).registerStore.shared_resource.value, finalValue);
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1658: Operation History Auditing & Cryptographic Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1658: Operation history auditing & cryptographic receipt generation", () => {
    const cluster = new EosJepsenDistributedChaosCore({
      nodeCount: 3,
      seed: 500,
    });

    // Write and read sequence
    cluster.write("node-0", "balance", 1000);
    cluster.processPackets(20);
    const readOp = cluster.read("node-1", "balance");
    assert.equal(readOp.value, 1000);

    // Clock skew injection
    cluster.injectClockSkew("node-2", 50);
    assert.equal(cluster.getNode("node-2").wallClockOffsetMs, 50);

    const audit = cluster.auditConsistency();
    assert.equal(audit.linearizabilityViolations, 0);
    assert.equal(audit.staleReadsDetected, 0);

    const receipt = cluster.generateReceipt();
    assert.equal(receipt.specRef, "SPEC-313");
    assert.equal(receipt.converged, true);
    assert.equal(receipt.linearizabilityViolations, 0);
    assert.ok(receipt.sha256.length === 64);

    // Boundary validations
    assert.throws(() => new EosJepsenDistributedChaosCore({ nodeCount: 0, seed: 1 }), /at least 1/);
    assert.throws(() => cluster.getNode("invalid-node"), /not found/);
    assert.throws(() => cluster.injectClockSkew("invalid-node", 10), /unknown node/);

    // Seed 0 fallback
    const fallbackCluster = createJepsenCluster(2, 0);
    assert.equal(fallbackCluster.getAllNodes().length, 2);

    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });

  // -------------------------------------------------------------------------
  // BDD-1658b: CLI Dispatch, Dynamic Topologies & Asymmetric Partitions
  // -------------------------------------------------------------------------
  it("BDD-1658b: CLI dispatch, dynamic topologies & asymmetric partitions", async () => {
    // 1. toolchain:jepsen:simulate with dynamic partitions and json
    await handleJepsenChaosCommand({
      command: "toolchain:jepsen:simulate",
      args: ["--nodes=6", '--partitions="0,1|2,3,4,5"', "--loss=0.05", "--skew=10", "--json"],
    });

    // 2. toolchain:jepsen:partition with asymmetric severed links
    await handleJepsenChaosCommand({
      command: "toolchain:jepsen:partition",
      args: ["--nodes=4", "--type=ASYMMETRIC", '--sever="0->2"', "--json"],
    });

    // 3. toolchain:jepsen:heal with custom subsets
    await handleJepsenChaosCommand({
      command: "toolchain:jepsen:heal",
      args: ["--nodes=4", '--partitions="0,1|2,3"', "--json"],
    });

    // 4. toolchain:jepsen:verify
    await handleJepsenChaosCommand({
      command: "toolchain:jepsen:verify",
      args: ["--nodes=3", "--json"],
    });

    // 5. toolchain:jepsen:audit and receipt writing
    await handleJepsenChaosCommand({
      command: "toolchain:jepsen:audit",
      args: ["--json"],
    });
    assert.ok(fs.existsSync(RECEIPT_PATH));

    // 6. Unknown command rejection
    await assert.rejects(
      async () =>
        handleJepsenChaosCommand({
          command: "toolchain:jepsen:unknown",
          args: [],
        }),
      /Unknown toolchain:jepsen command/,
    );
  });
});
