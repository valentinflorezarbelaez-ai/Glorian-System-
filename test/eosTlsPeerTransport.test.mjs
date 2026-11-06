import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { EosTlsPeerTransport } from "../src/core/eosTlsPeerTransport.ts";

test("BDD-251: Negociación exitosa de canal mTLS bidireccional con identidad SPIFFE (SPEC-088)", async () => {
  const nodeA = new EosTlsPeerTransport("alpha-node");
  const nodeB = new EosTlsPeerTransport("beta-node");

  const portA = await nodeA.start(0);
  const portB = await nodeB.start(0);

  assert.ok(portA > 0);
  assert.ok(portB > 0);

  const receivedOnB = [];
  nodeB.onSecureMessage((msg) => {
    receivedOnB.push(msg);
  });

  // Connect node A to node B over mutual TLS
  await nodeA.connectToPeer(portB);

  // Short delay for mutual handshake completion
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(nodeA.getPeerCount(), 1);
  assert.equal(nodeB.getPeerCount(), 1);

  // Broadcast AES-256-GCM encrypted message
  nodeA.broadcastEncrypted("TRUETIME_CONSENSUS_VOTE", {
    term: 101,
    commitTimestamp: 1730381000000,
    attestedLinearizable: true
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(receivedOnB.length, 1);
  const msg = receivedOnB[0];
  assert.equal(msg.fromNodeId, "alpha-node");
  assert.equal(msg.spiffeUri, "spiffe://eos.system/node/alpha-node");
  assert.equal(msg.type, "TRUETIME_CONSENSUS_VOTE");
  assert.equal(msg.payload.attestedLinearizable, true);
  assert.equal(nodeB.getSecurityAnomalyCount(), 0);

  await nodeA.stop();
  await nodeB.stop();
});

test("BDD-252: Rechazo fail-closed de pares con certificados manipulados o no confiables (SPEC-088)", async () => {
  const nodeServer = new EosTlsPeerTransport("secure-server");
  const port = await nodeServer.start(0);

  // Rogue client attempting connection with unauthenticated JSON frame
  const rogueSocket = net.createConnection({ port, host: "127.0.0.1" });
  await new Promise((resolve) => rogueSocket.on("connect", resolve));

  const forgedPayload = {
    identity: {
      nodeId: "impostor-node",
      spiffeUri: "spiffe://rogue-domain.org/node/impostor",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0...\n-----END PUBLIC KEY-----"
    },
    ecdhPublicKeyHex: "04deadbeef",
    timestampIso: new Date().toISOString(),
    signatureHex: "0000000000000000"
  };

  rogueSocket.write(JSON.stringify(forgedPayload) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 80));

  // Server should reject and terminate socket
  assert.equal(nodeServer.getPeerCount(), 0, "Forged peer must not be added to active peers");
  assert.ok(nodeServer.getSecurityAnomalyCount() >= 1, "Security anomaly count must increment");

  rogueSocket.destroy();
  await nodeServer.stop();
});
