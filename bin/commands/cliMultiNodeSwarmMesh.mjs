/**
 * @file cliMultiNodeSwarmMesh.mjs
 * @description CLI handler for SPEC-365 / CHANGE-227: Decentralized Multi-Node Swarm Clustering & P2P Mesh Gossip.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMultiNodeSwarmMesh } from "../../src/core/eosMultiNodeSwarmMesh.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("MULTI_NODE_SWARM_MESH_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_mesh_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const mesh = new EosMultiNodeSwarmMesh();
  const receipt = await mesh.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Decentralized Multi-Node Swarm Clustering & P2P Mesh Gossip (SPEC-365) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Local Node ID           : ${receipt.localNodeId}`);
    console.log(`Simulated Cluster Size  : ${receipt.clusterSize} nodes`);
    console.log(`Convergence Latency     : ${receipt.convergenceLatencyMs} ms (< 100ms TARGET)`);
    console.log(`Checks Summary          :`);
    console.log(`  - Layer-0 P2P Transport : ${receipt.checks.layerZeroP2PTransport}`);
    console.log(`  - Peer Handshake        : ${receipt.checks.peerDiscoveryHandshake}`);
    console.log(`  - Anti-Entropy Gossip   : ${receipt.checks.epidemicAntiEntropyGossip}`);
    console.log(`  - Merkle-DAG Replication: ${receipt.checks.merkleDagLedgerReplication}`);
    console.log(`  - Byzantine Fault Tol.  : ${receipt.checks.byzantineFaultTolerance}`);
    console.log(`  - Cross-Node Work Steal : ${receipt.checks.crossNodeTaskWorkStealing}`);
    console.log(`  - Zero Dependency Purity: ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity SHA-256       : ${receipt.integrityHash}`);
  }
}

async function cmd_mesh_status(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const mesh = new EosMultiNodeSwarmMesh({ localNodeId: "local-primary" });
  const status = mesh.getClusterStatus();

  if (isJson) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log("=== Multi-Node Swarm Mesh Cluster Status ===");
    console.log(`Local Node ID           : ${status.localNodeId}`);
    console.log(`State                   : ${status.state}`);
    console.log(`Active Peers Count      : ${status.activePeersCount}`);
    console.log(`Total Cluster Nodes     : ${status.totalClusterNodes}`);
    console.log(`Cluster Merkle Root     : ${status.clusterMerkleRoot.substring(0, 16)}...`);
    console.log(`Gossip Rounds Completed : ${status.gossipRoundsCompleted}`);
    console.log(`Task Queue Depth        : ${status.totalTasksInMesh}`);
  }
}

async function cmd_mesh_peer(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const remoteId = args.find((a) => !a.startsWith("--")) || "remote-node-seed";
  const mesh = new EosMultiNodeSwarmMesh({ localNodeId: "local-cli" });

  const handshake = mesh.handlePeerHandshake(remoteId);

  if (isJson) {
    console.log(JSON.stringify(handshake, null, 2));
  } else {
    console.log("=== P2P Mesh Handshake Established ===");
    console.log(`Local Node ID  : ${handshake.localNodeId}`);
    console.log(`Remote Node ID : ${remoteId}`);
    console.log(`Handshake RTT  : ${handshake.latencyMs} ms`);
    console.log(`Status         : CONNECTED (ONLINE)`);
  }
}

async function cmd_mesh_gossip(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const mesh = new EosMultiNodeSwarmMesh({ localNodeId: "local-cli" });

  const digest = mesh.createGossipDigest();

  if (isJson) {
    console.log(JSON.stringify(digest, null, 2));
  } else {
    console.log("=== Epidemic Anti-Entropy Gossip Digest ===");
    console.log(`Origin Node ID : ${digest.originNodeId}`);
    console.log(`Gossip Round   : ${digest.round}`);
    console.log(`Version Vector : ${JSON.stringify(digest.versionVector)}`);
    console.log(`Digest Hash    : ${digest.digestHash.substring(0, 16)}...`);
  }
}

HANDLERS["toolchain:mesh:audit"] = cmd_mesh_audit;
HANDLERS["toolchain:mesh:status"] = cmd_mesh_status;
HANDLERS["toolchain:mesh:peer"] = cmd_mesh_peer;
HANDLERS["toolchain:mesh:gossip"] = cmd_mesh_gossip;

export async function handleMultiNodeSwarmMeshCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:mesh command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
