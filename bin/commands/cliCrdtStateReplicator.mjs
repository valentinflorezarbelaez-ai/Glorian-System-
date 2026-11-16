/**
 * CLI Decentralized Merkle-CRDT State Replication Handlers
 *
 * Implements toolchain:crdt:* subcommands for cross-fleet replication,
 * join-semilattice merges, anti-entropy synchronization, and audit receipts.
 *
 * Conforms to SPEC-308 / CHANGE-170.
 */

import { EosCrdtStateReplicatorCore } from "../../src/core/eosCrdtStateReplicator.ts";

const HANDLERS = {};

async function cmd_crdt_replicate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const replicator = new EosCrdtStateReplicatorCore("cli-agent-1");
  const node1 = replicator.createNode("LWW_REGISTER", "fleet:status", { mode: "AUTONOMOUS", timestamp: Date.now() });
  const node2 = replicator.createNode("PN_COUNTER", "fleet:requests", { type: "INC", amount: 42 });
  const node3 = replicator.createNode("OR_SET", "fleet:active_nodes", {
    action: "ADD",
    tag: "tag-node-a",
    value: "worker-us-east",
  });

  const root = replicator.computeMerkleRoot();

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          actor: replicator.getActorId(),
          nodesCount: replicator.getNodeCount(),
          merkleRoot: root,
          nodes: [node1, node2, node3],
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MERKLE-CRDT STATE REPLICATION (SPEC-308)             `);
  console.log(`===============================================================`);
  console.log(`  Actor Node   : ${replicator.getActorId()}`);
  console.log(`  Nodes Count  : ${replicator.getNodeCount()}`);
  console.log(`  Merkle Root  : ${root.slice(0, 32)}...`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  [NODE 1] CID: ${node1.cid.slice(0, 16)}... | Key: ${node1.key} (LWW)`);
  console.log(`  [NODE 2] CID: ${node2.cid.slice(0, 16)}... | Key: ${node2.key} (PN_COUNTER)`);
  console.log(`  [NODE 3] CID: ${node3.cid.slice(0, 16)}... | Key: ${node3.key} (OR_SET)`);
  console.log(`===============================================================\n`);
}

async function cmd_crdt_merge(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const regA = { value: "val-alpha", lamport: 5, actor: "node-a", timestamp: 1000 };
  const regB = { value: "val-beta", lamport: 7, actor: "node-b", timestamp: 1050 };
  const mergedLww = EosCrdtStateReplicatorCore.mergeLww(regA, regB);

  const vecA = new Int32Array([10, 40, 30, 90]);
  const vecB = new Int32Array([20, 25, 60, 80]);
  const linearMerge = EosCrdtStateReplicatorCore.mergeLinearMemoryVectors(vecA, vecB);

  if (isJson) {
    console.log(JSON.stringify({ mergedLww, linearMerge }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CRDT JOIN-SEMILATTICE CONVERGENCE (SPEC-308)         `);
  console.log(`===============================================================`);
  console.log(`  LWW Merge Result : ${JSON.stringify(mergedLww.value)} (winner: ${mergedLww.actor})`);
  console.log(`  Lamport Winner   : ${mergedLww.lamport}`);
  console.log(`  Linear Vec Merge : [${linearMerge.mergedElements.join(", ")}]`);
  console.log(`  Duration         : ${linearMerge.durationNs} ns (~${Math.round(linearMerge.durationNs / 1000)} µs)`);
  console.log(`===============================================================\n`);
}

async function cmd_crdt_anti_entropy(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const replicaA = new EosCrdtStateReplicatorCore("replica-eu");
  const replicaB = new EosCrdtStateReplicatorCore("replica-us");

  replicaA.createNode("LWW_REGISTER", "cluster:region", "eu-central");
  replicaB.createNode("LWW_REGISTER", "cluster:region", "us-east");
  replicaB.createNode("PN_COUNTER", "cluster:jobs", { type: "INC", amount: 10 });

  const syncResult = replicaA.antiEntropySync(replicaB);

  if (isJson) {
    console.log(JSON.stringify(syncResult, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ANTI-ENTROPY MERKLE SYNC (SPEC-308)                  `);
  console.log(`===============================================================`);
  console.log(`  Converged In Sync: ${syncResult.inSync}`);
  console.log(`  Local Root       : ${syncResult.localRoot.slice(0, 24)}...`);
  console.log(`  Remote Root      : ${syncResult.remoteRoot.slice(0, 24)}...`);
  console.log(`  Divergent Nodes  : ${syncResult.divergentNodesCount}`);
  console.log(`  Duration         : ${syncResult.durationMs} ms`);
  console.log(`===============================================================\n`);
}

async function cmd_crdt_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await EosCrdtStateReplicatorCore.auditCrdtReplicationPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN CRDT REPLICATION AUDIT RECEIPT (SPEC-308)            `);
  console.log(`===============================================================`);
  console.log(`  Spec Reference   : ${receipt.specRef}`);
  console.log(`  Change Reference : ${receipt.changeRef}`);
  console.log(`  Status           : ${receipt.status}`);
  console.log(`  Fleet Projects   : ${receipt.fleetProjectsAudited}`);
  console.log(`  Associativity    : ${receipt.semilatticePropertiesVerified.associativity ? "VERIFIED" : "FAILED"}`);
  console.log(`  Commutativity    : ${receipt.semilatticePropertiesVerified.commutativity ? "VERIFIED" : "FAILED"}`);
  console.log(`  Idempotency      : ${receipt.semilatticePropertiesVerified.idempotency ? "VERIFIED" : "FAILED"}`);
  console.log(`  Linear Memory    : ${receipt.linearMemoryBenchmarkNsPerOp} ns/op`);
  console.log(`  Receipt Signature: ${receipt.cryptographicSignature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:replicator:replicate"] = cmd_crdt_replicate;
HANDLERS["toolchain:replicator:merge"] = cmd_crdt_merge;
HANDLERS["toolchain:replicator:anti-entropy"] = cmd_crdt_anti_entropy;
HANDLERS["toolchain:replicator:audit"] = cmd_crdt_audit;

export async function handleCrdtCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:replicator command: ${command}`);
  }
  return handler(commandContext);
}
