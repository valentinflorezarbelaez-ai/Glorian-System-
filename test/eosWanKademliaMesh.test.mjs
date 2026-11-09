import test from "node:test";
import assert from "node:assert/strict";

import { EosWanKademliaMesh } from "../src/core/eosWanKademliaMesh.ts";

test("BDD-259: Cálculo determinista de distancia métrica XOR e inserción en K-buckets (SPEC-092)", () => {
  const mesh = new EosWanKademliaMesh("node-local-alpha");

  const distSelf = EosWanKademliaMesh.calculateDistance("node-local-alpha", "node-local-alpha");
  assert.equal(distSelf, 0n, "Distance to self must be 0");

  const distAB = EosWanKademliaMesh.calculateDistance("node-A", "node-B");
  const distBA = EosWanKademliaMesh.calculateDistance("node-B", "node-A");
  assert.equal(distAB, distBA, "Distance metric must be symmetric");
  assert.ok(distAB > 0n);

  // Insert nodes
  mesh.addOrUpdateNode({ nodeId: "node-peer-1", ip: "198.51.100.1", port: 8001, lastSeenMs: Date.now() });
  mesh.addOrUpdateNode({ nodeId: "node-peer-2", ip: "198.51.100.2", port: 8002, lastSeenMs: Date.now() });

  assert.equal(mesh.getNodeCount(), 2);
});

test("BDD-260: Búsqueda convergente de los k nodos más cercanos a un identificador objetivo (SPEC-092)", () => {
  const mesh = new EosWanKademliaMesh("root-seed-node");

  // Populate 30 peer nodes
  for (let i = 1; i <= 30; i++) {
    mesh.addOrUpdateNode({
      nodeId: `wan-node-${i}`,
      ip: `10.0.0.${i}`,
      port: 9000 + i,
      lastSeenMs: Date.now(),
    });
  }

  assert.equal(mesh.getNodeCount(), 30);

  // Search closest to "target-key-alpha"
  const closest = mesh.findClosestNodes("target-key-alpha", 10);
  assert.equal(closest.length, 10);

  // Verify ascending distance ordering
  const targetBigInt = EosWanKademliaMesh.idToBigInt("target-key-alpha");
  for (let i = 0; i < closest.length - 1; i++) {
    const distCurrent = EosWanKademliaMesh.idToBigInt(closest[i].nodeId) ^ targetBigInt;
    const distNext = EosWanKademliaMesh.idToBigInt(closest[i + 1].nodeId) ^ targetBigInt;
    assert.ok(distCurrent <= distNext, "Closest nodes must be sorted monotonically ascending");
  }

  // Prune a node
  const removed = mesh.pruneNode(closest[0].nodeId);
  assert.equal(removed, true);
  assert.equal(mesh.getNodeCount(), 29);
});

test("BDD-261: Edge cases: getLocalNodeId, self-add ignore, update existing, bucket overflow, prune non-existent", () => {
  const mesh = new EosWanKademliaMesh("local-node-xyz");
  assert.equal(mesh.getLocalNodeId(), "local-node-xyz");

  // 1. Ignore self node
  mesh.addOrUpdateNode({ nodeId: "local-node-xyz", ip: "127.0.0.1", port: 9000, lastSeenMs: 100 });
  assert.equal(mesh.getNodeCount(), 0);

  // 2. Add and then update existing node
  mesh.addOrUpdateNode({ nodeId: "peer-1", ip: "10.0.0.1", port: 9001, lastSeenMs: 100 });
  mesh.addOrUpdateNode({ nodeId: "peer-1", ip: "10.0.0.1", port: 9001, lastSeenMs: 200 });
  assert.equal(mesh.getNodeCount(), 1);

  // 3. Prune non-existent node returns false
  const notFoundPruned = mesh.pruneNode("non-existent-peer");
  assert.equal(notFoundPruned, false);

  // 4. Force bucket overflow (>20 nodes in a single bucket)
  const overflowPeer = "synthetic-overflow-target";
  const targetBucket = mesh.getBucketIndex(overflowPeer);
  // Prefill target bucket to capacity (20)
  mesh.buckets[targetBucket].length = 0;
  for (let i = 0; i < 20; i++) {
    mesh.buckets[targetBucket].push({
      nodeId: `prefilled-${i}`,
      ip: `10.0.1.${i}`,
      port: 9100 + i,
      lastSeenMs: Date.now(),
    });
  }
  // Adding 21st node must trigger bucket eviction branch (shift oldest, push new)
  mesh.addOrUpdateNode({
    nodeId: overflowPeer,
    ip: "10.0.1.99",
    port: 9199,
    lastSeenMs: Date.now(),
  });
  assert.equal(mesh.buckets[targetBucket].length, 20);
  assert.equal(mesh.buckets[targetBucket][19].nodeId, overflowPeer);

  // 5. findClosestNodes identical distance comparator check (distA === distB -> return 0)
  mesh.buckets[0].push({ nodeId: "identical-dist", ip: "10.0.2.1", port: 9200, lastSeenMs: 100 });
  mesh.buckets[1].push({ nodeId: "identical-dist", ip: "10.0.2.2", port: 9201, lastSeenMs: 100 });
  const closestAll = mesh.findClosestNodes("target-query", 10);
  assert.ok(closestAll.length > 0);
});
