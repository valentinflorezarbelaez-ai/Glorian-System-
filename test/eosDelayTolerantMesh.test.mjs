/**
 * Test Suite: EosDelayTolerantMesh (Layer 0 — Delay-Tolerant Networking & Opportunistic Bundle Protocol)
 * SPEC-190: Delay-Tolerant Networking & Opportunistic Bundle Protocol Engine
 * CHANGE-075: Delay-Tolerant Networking & Opportunistic Bundle Protocol Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosDelayTolerantMesh } from "../src/core/eosDelayTolerantMesh.ts";
import { pureSha256 } from "../src/core/eosKernelPrimitives.ts";

describe("SPEC-190: EosDelayTolerantMesh", () => {
  it("BDD-968: creates bundle with cryptographic digest and local custody", () => {
    const mesh = new EosDelayTolerantMesh("ground-station-alpha");

    const payload = { telemetry: "rover_speed", valueMs: 1.4 };
    const bundle = mesh.createBundle("mars-rover-curiosity", payload, 7200000);

    assert.ok(bundle.bundleId.startsWith("BUNDLE-"));
    assert.equal(bundle.sourceNodeId, "ground-station-alpha");
    assert.equal(bundle.destinationNodeId, "mars-rover-curiosity");
    assert.equal(bundle.custodianNodeId, "ground-station-alpha");
    assert.equal(bundle.custodyStatus, "HELD");
    assert.equal(bundle.hopCount, 0);

    const expectedDigest = pureSha256(JSON.stringify(payload));
    assert.equal(bundle.payloadDigestSha256, expectedDigest);

    const retrieved = mesh.getBundle(bundle.bundleId);
    assert.ok(retrieved);
    assert.equal(retrieved.bundleId, bundle.bundleId);
  });

  it("BDD-969: executes custody transfer during active contact window", () => {
    const mesh = new EosDelayTolerantMesh("ground-station-1");
    const bundle = mesh.createBundle("deep-space-probe", "course_correction", 3600000);

    // Cannot transfer without active contact window
    assert.throws(() => mesh.transferCustody(bundle.bundleId, "relay-orbiter-1"));

    // Open contact window
    mesh.openContact("relay-orbiter-1", 10000);
    assert.equal(mesh.isContactOpen("relay-orbiter-1"), true);

    // Transfer custody
    const receipt = mesh.transferCustody(bundle.bundleId, "relay-orbiter-1");
    assert.equal(receipt.bundleId, bundle.bundleId);
    assert.equal(receipt.previousCustodianId, "ground-station-1");
    assert.equal(receipt.newCustodianId, "relay-orbiter-1");
    assert.equal(receipt.receiptSignatureSha256.length, 64);

    // Bundle status updated
    const updated = mesh.getBundle(bundle.bundleId);
    assert.equal(updated?.custodianNodeId, "relay-orbiter-1");
    assert.equal(updated?.custodyStatus, "TRANSFERRED");
  });

  it("BDD-970: store-and-forward multi-hop opportunistic delivery", () => {
    // 3 Disconnected Nodes: Node A (Source), Node B (Relay), Node C (Destination)
    const nodeA = new EosDelayTolerantMesh("earth-station");
    const nodeB = new EosDelayTolerantMesh("lunar-gateway-relay");
    const nodeC = new EosDelayTolerantMesh("artemis-base");

    // 1. Node A creates bundle for Node C
    const bundle = nodeA.createBundle("artemis-base", { command: "activate_solar_array" });

    // 2. Opportunistic contact between Node A and Node B
    nodeA.openContact("lunar-gateway-relay", 5000);
    nodeA.transferCustody(bundle.bundleId, "lunar-gateway-relay");

    const receiveHop1 = nodeB.receiveBundle(bundle);
    assert.equal(receiveHop1.accepted, true);
    assert.equal(receiveHop1.delivered, false); // Intermediate transit hop
    assert.equal(nodeB.getBundle(bundle.bundleId)?.custodyStatus, "HELD");
    assert.equal(nodeB.getBundle(bundle.bundleId)?.hopCount, 1);

    // 3. Opportunistic contact between Node B and Node C
    nodeB.openContact("artemis-base", 5000);
    nodeB.transferCustody(bundle.bundleId, "artemis-base");

    const receiveHop2 = nodeC.receiveBundle(nodeB.getBundle(bundle.bundleId));
    assert.equal(receiveHop2.accepted, true);
    assert.equal(receiveHop2.delivered, true); // Final destination reached
    assert.equal(nodeC.getBundle(bundle.bundleId)?.custodyStatus, "DELIVERED");
    assert.equal(nodeC.getBundle(bundle.bundleId)?.hopCount, 2);
    assert.equal(nodeC.getMeshMetrics().deliveredCount, 1);
  });

  it("BDD-971: prunes expired bundles when TTL elapses", () => {
    const mesh = new EosDelayTolerantMesh("sensor-buoy");

    const shortLived = mesh.createBundle("mothership", "ocean_temp", 50);

    // At creation + 20ms: not expired
    let pruneResult = mesh.evaluatePruning(shortLived.creationTimestamp + 20);
    assert.equal(pruneResult.prunedBundleIds.length, 0);
    assert.ok(mesh.getBundle(shortLived.bundleId));

    // At creation + 100ms: expired
    pruneResult = mesh.evaluatePruning(shortLived.creationTimestamp + 100);
    assert.deepEqual(pruneResult.prunedBundleIds, [shortLived.bundleId]);
    assert.equal(mesh.getBundle(shortLived.bundleId), undefined);
  });

  it("BDD-972: anti-entropy manifest delta reconciliation", () => {
    const node1 = new EosDelayTolerantMesh("node-1");
    const node2 = new EosDelayTolerantMesh("node-2");

    const b1 = node1.createBundle("node-3", "payload-1");
    const b2 = node1.createBundle("node-3", "payload-2");
    const b3 = node2.createBundle("node-3", "payload-3");

    const manifest1 = node1.generateManifest();
    const manifest2 = node2.generateManifest();
    assert.equal(manifest1.nodeId, "node-1");

    // From node1 perspective relative to node2:
    // node1 needs b3 (node2 has it), node1 offers b1 and b2
    const delta1 = node1.computeManifestDelta(manifest2);
    assert.deepEqual(delta1.neededBundleIds, [b3.bundleId]);
    assert.deepEqual(delta1.offeredBundleIds.sort(), [b1.bundleId, b2.bundleId].sort());
  });

  it("BDD-973: rejects tampered bundle payload with integrity error", () => {
    const mesh = new EosDelayTolerantMesh("sentinel-node");
    const bundle = mesh.createBundle("destination", "authentic_content");

    // Tamper with payload
    const tampered = { ...bundle, payload: "corrupted_or_forged_content" };
    const res = mesh.receiveBundle(tampered);

    assert.equal(res.accepted, false);
    assert.equal(res.reason, "PAYLOAD_INTEGRITY_MISMATCH");
  });
});
