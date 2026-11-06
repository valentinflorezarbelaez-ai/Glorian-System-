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
      lastSeenMs: Date.now()
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
