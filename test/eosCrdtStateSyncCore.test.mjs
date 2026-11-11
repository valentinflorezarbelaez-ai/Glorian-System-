/**
 * EOS Layer-0 Conflict-Free Replicated Data Types (CRDT) Core Test Suite
 * Governed by SPEC-215: FR-1094..FR-1098 and BDD-1094..BDD-1098.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosCrdtStateSyncCore,
  vectorClockIncrement,
  vectorClockJoin,
  vectorClockCompare,
  lwwRegisterMerge,
  orSetAdd,
  orSetRemove,
  orSetRead,
  orSetMerge,
  rgaReconstruct,
  rgaRead,
  rgaMerge,
} from "../src/core/eosCrdtStateSyncCore.ts";

describe("EosCrdtStateSyncCore (SPEC-215 / BDD-1094..BDD-1098)", () => {
  test("BDD-1094: Causal Vector Clock Invariants and Partial Ordering", () => {
    assert.strictEqual(typeof EosCrdtStateSyncCore, "function");

    // 1. Increments
    let clockA = {};
    clockA = vectorClockIncrement(clockA, "node-A");
    clockA = vectorClockIncrement(clockA, "node-A");
    assert.strictEqual(clockA["node-A"], 2);

    let clockB = {};
    clockB = vectorClockIncrement(clockB, "node-B");
    assert.strictEqual(clockB["node-B"], 1);

    // 2. Comparisons
    assert.strictEqual(vectorClockCompare(clockA, clockA), "EQUAL");
    assert.strictEqual(vectorClockCompare(clockA, clockB), "CONCURRENT");

    const clockA2 = { ...clockA, "node-B": 1 };
    assert.strictEqual(vectorClockCompare(clockB, clockA2), "LESS");
    assert.strictEqual(vectorClockCompare(clockA2, clockB), "GREATER");

    // 3. Supremum Join
    const joined = vectorClockJoin(clockA, clockB);
    assert.strictEqual(joined["node-A"], 2);
    assert.strictEqual(joined["node-B"], 1);
    assert.strictEqual(vectorClockCompare(joined, clockA), "GREATER");
    assert.strictEqual(vectorClockCompare(joined, clockB), "GREATER");
  });

  test("BDD-1095: LWW-Register Deterministic Conflict Resolution", () => {
    const regA = { value: "val-A", timestamp: 100, nodeId: "node-1" };
    const regB = { value: "val-B", timestamp: 100, nodeId: "node-2" };

    // Same timestamp: lexicographical tie-break ("node-2" > "node-1")
    const merged1 = lwwRegisterMerge(regA, regB);
    const merged2 = lwwRegisterMerge(regB, regA);
    assert.strictEqual(merged1.value, "val-B");
    assert.strictEqual(merged2.value, "val-B", "LWW merge must be commutative");

    // Different timestamps
    const regNewer = { value: "val-C", timestamp: 105, nodeId: "node-0" };
    assert.strictEqual(lwwRegisterMerge(regA, regNewer).value, "val-C");
  });

  test("BDD-1096: ORSet Concurrent Add-Remove Anomaly-Free Resolution", () => {
    let set1 = { adds: [], removes: [] };
    let set2 = { adds: [], removes: [] };

    // Initial state: both have "config-entry"
    set1 = orSetAdd(set1, "config-entry", "node-1", 1, 1);
    set2 = orSetAdd(set2, "config-entry", "node-1", 1, 1);

    // Node 1 removes "config-entry"
    set1 = orSetRemove(set1, "config-entry");
    assert.deepStrictEqual(orSetRead(set1), []);

    // Concurrently, Node 2 re-adds "config-entry" with a fresh tag
    set2 = orSetAdd(set2, "config-entry", "node-2", 2, 2);
    assert.deepStrictEqual(orSetRead(set2), ["config-entry"]);

    // Merge in both directions
    const merged12 = orSetMerge(set1, set2);
    const merged21 = orSetMerge(set2, set1);

    // "config-entry" MUST remain in the set due to the fresh addition tag
    assert.deepStrictEqual(orSetRead(merged12), ["config-entry"]);
    assert.deepStrictEqual(orSetRead(merged21), ["config-entry"]);
  });

  test("BDD-1097: RGA Collaborative Text and Sequence Ordering", () => {
    // Shared initial text: "HELLO"
    const rootNodes = [
      { id: "1:root:1", parentId: null, value: "H", deleted: false, timestamp: 1, nodeId: "root" },
      { id: "1:root:2", parentId: "1:root:1", value: "E", deleted: false, timestamp: 1, nodeId: "root" },
      { id: "1:root:3", parentId: "1:root:2", value: "L", deleted: false, timestamp: 1, nodeId: "root" },
      { id: "1:root:4", parentId: "1:root:3", value: "L", deleted: false, timestamp: 1, nodeId: "root" },
      { id: "1:root:5", parentId: "1:root:4", value: "O", deleted: false, timestamp: 1, nodeId: "root" },
    ];
    assert.strictEqual(rgaRead(rootNodes).join(""), "HELLO");

    // Replica 1 inserts "!" after "O" at timestamp 2
    const n1 = { id: "2:node1:1", parentId: "1:root:5", value: "!", deleted: false, timestamp: 2, nodeId: "node1" };
    // Replica 2 inserts "?" after "O" at timestamp 3
    const n2 = { id: "3:node2:1", parentId: "1:root:5", value: "?", deleted: false, timestamp: 3, nodeId: "node2" };

    const replica1 = [...rootNodes, n1];
    const replica2 = [...rootNodes, n2];

    const merged1 = rgaMerge(replica1, replica2);
    const merged2 = rgaMerge(replica2, replica1);

    // Both must converge to "HELLO?!" because timestamp 3 > timestamp 2
    assert.strictEqual(rgaRead(merged1).join(""), "HELLO?!");
    assert.strictEqual(rgaRead(merged2).join(""), "HELLO?!");
    assert.deepStrictEqual(rgaReconstruct(merged1), rgaReconstruct(merged2));
  });

  test("BDD-1098: Delta-State Convergence and CLI/MCP Dispatch", () => {
    const nodeA = new EosCrdtStateSyncCore("node-A");
    const nodeB = new EosCrdtStateSyncCore("node-B");

    nodeA.setRegister("cluster", "ALPHA");
    nodeA.addToSet("roles", "ADMIN");
    nodeA.insertSequence("stream", "X");

    nodeB.setRegister("cluster", "BETA");
    nodeB.addToSet("roles", "WORKER");
    nodeB.insertSequence("stream", "Y");

    // Full snapshot merge
    const snapA = nodeA.exportSnapshot();
    const snapB = nodeB.exportSnapshot();
    const resA = nodeA.mergeSnapshot(snapB);
    const resB = nodeB.mergeSnapshot(snapA);

    assert.strictEqual(resA.converged, true);
    assert.strictEqual(resB.converged, true);
    assert.strictEqual(resA.stateHashSha256, resB.stateHashSha256);
    assert.strictEqual(resA.receipt.operation, "merge");
    assert.strictEqual(resA.receipt.receiptSha256.length, 64);

    // Delta sync
    const nodeC = new EosCrdtStateSyncCore("node-C");
    const deltaForC = nodeA.getDelta(nodeC.vectorClock);
    const deltaRes = nodeC.mergeDelta(deltaForC);
    assert.strictEqual(deltaRes.converged, true);
    assert.strictEqual(nodeC.getRegister("cluster"), nodeA.getRegister("cluster"));

    // CLI Execution
    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");

    const mutateOutput = execFileSync("node", [cliPath, "crdt:mutate", "--json"], {
      encoding: "utf8",
    });
    const mutateJson = JSON.parse(mutateOutput);
    assert.strictEqual(mutateJson.nodeId, "node-alpha");
    assert.ok(mutateJson.stateHashSha256);

    const mergeOutput = execFileSync("node", [cliPath, "crdt:merge", "--json"], {
      encoding: "utf8",
    });
    const mergeJson = JSON.parse(mergeOutput);
    assert.strictEqual(mergeJson.strongConsistency, true);
    assert.ok(mergeJson.convergedHash);

    const deltaOutput = execFileSync("node", [cliPath, "crdt:delta", "--json"], {
      encoding: "utf8",
    });
    const deltaJson = JSON.parse(deltaOutput);
    assert.strictEqual(deltaJson.sourceNode, "node-A");
    assert.ok(deltaJson.convergedStateHash);
  });
});
