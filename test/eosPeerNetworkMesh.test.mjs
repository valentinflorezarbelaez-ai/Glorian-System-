import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { EosPeerNode, computeFrameSha256 } from "../src/core/eosPeerNetworkMesh.ts";

test("BDD-243: Comunicación bidireccional entre nodos pares locales (SPEC-084)", async () => {
  const nodeA = new EosPeerNode("node-alpha");
  const nodeB = new EosPeerNode("node-beta");

  const portA = await nodeA.start(0);
  const portB = await nodeB.start(0);

  assert.ok(portA > 0, "Node A must have assigned port");
  assert.ok(portB > 0, "Node B must have assigned port");

  const receivedFrames = [];
  nodeB.onMessage((frame) => {
    receivedFrames.push(frame);
  });

  // Connect node A to node B
  await nodeA.connectToPeer(portB);

  // Allow short socket handshaking
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Node A broadcasts TrueTime sync frame
  const sentFrame = nodeA.broadcastFrame("TRUETIME_SYNC", {
    earliest: 1730380000000,
    latest: 1730380000007,
    uncertaintyEpsilonMs: 3.5
  });

  // Wait for frame to be delivered over TCP
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(receivedFrames.length, 1);
  const received = receivedFrames[0];
  assert.equal(received.senderNodeId, "node-alpha");
  assert.equal(received.seq, 1);
  assert.equal(received.type, "TRUETIME_SYNC");
  assert.equal(received.frameSha256, sentFrame.frameSha256);
  assert.equal(received.payload.uncertaintyEpsilonMs, 3.5);
  assert.equal(nodeB.getAnomalyCount(), 0);

  await nodeA.stop();
  await nodeB.stop();
});

test("BDD-244: Rechazo fail-closed de frames manipulados o repetidos (SPEC-084)", async () => {
  const node = new EosPeerNode("node-verifier");
  const port = await node.start(0);

  const receivedFrames = [];
  node.onMessage((frame) => {
    receivedFrames.push(frame);
  });

  const client = net.createConnection({ port, host: "127.0.0.1" });
  await new Promise((resolve) => client.on("connect", resolve));

  // 1. Send tampered frame: hash does not match content
  const tamperedFrame = {
    senderNodeId: "rogue-agent",
    seq: 1,
    type: "CONSENSUS_VOTE",
    payload: { vote: "INVALID_STATE" },
    timestampIso: new Date().toISOString(),
    frameSha256: "0000000000000000000000000000000000000000000000000000000000000000"
  };
  client.write(JSON.stringify(tamperedFrame) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(receivedFrames.length, 0, "Tampered frame must be discarded");
  assert.equal(node.getAnomalyCount(), 1, "Anomaly count must increase for tampered frame");

  // 2. Send valid frame seq 1
  const validTimestamp = new Date().toISOString();
  const validPayload = { term: 42, candidate: "node-leader" };
  const validHash = computeFrameSha256(
    "legit-peer",
    1,
    "CONSENSUS_VOTE",
    validPayload,
    validTimestamp
  );

  const validFrame = {
    senderNodeId: "legit-peer",
    seq: 1,
    type: "CONSENSUS_VOTE",
    payload: validPayload,
    timestampIso: validTimestamp,
    frameSha256: validHash
  };

  client.write(JSON.stringify(validFrame) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(receivedFrames.length, 1, "Valid frame must be accepted");
  assert.equal(receivedFrames[0].seq, 1);
  assert.equal(node.getAnomalyCount(), 1);

  // 3. Replay attack: send valid frame seq 1 again
  client.write(JSON.stringify(validFrame) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(receivedFrames.length, 1, "Replayed frame must NOT be accepted");
  assert.equal(node.getAnomalyCount(), 2, "Anomaly count must increment on replay rejection");

  // 4. Send stale sequence: seq 0
  const staleTimestamp = new Date().toISOString();
  const staleHash = computeFrameSha256("legit-peer", 0, "HEARTBEAT", {}, staleTimestamp);
  const staleFrame = {
    senderNodeId: "legit-peer",
    seq: 0,
    type: "HEARTBEAT",
    payload: {},
    timestampIso: staleTimestamp,
    frameSha256: staleHash
  };
  client.write(JSON.stringify(staleFrame) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(receivedFrames.length, 1, "Stale frame must NOT be accepted");
  assert.equal(node.getAnomalyCount(), 3, "Anomaly count must increment on stale sequence");

  client.destroy();
  await node.stop();
});
