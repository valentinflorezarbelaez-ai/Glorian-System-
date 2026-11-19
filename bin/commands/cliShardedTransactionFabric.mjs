/**
 * @file cliShardedTransactionFabric.mjs
 * @description CLI handler for SPEC-351 / CHANGE-213: Autonomous Quantum-Resilient Distributed Transaction Fabric.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosShardedTransactionFabricCore } from "../../src/core/eosShardedTransactionFabric.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("SHARDED_TRANSACTION_FABRIC_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_txfabric_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosShardedTransactionFabricCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Quantum-Resilient Distributed Transaction Fabric (SPEC-351) ===");
    console.log(`Timestamp               : ${receipt.timestamp}`);
    console.log(`Status                  : ${receipt.status}`);
    console.log(`Total Shards            : ${receipt.totalShards}`);
    console.log(`Total Vnodes            : ${receipt.totalVnodes}`);
    console.log(`Ring Std Deviation      : ${receipt.ringBalanceStandardDeviation}`);
    console.log(`MVCC Isolation Verified : ${receipt.mvccIsolationVerified ? "PASS" : "FAIL"}`);
    console.log(`2PC Atomic Commit       : ${receipt.twoPhaseCommitVerified ? "PASS" : "FAIL"}`);
    console.log(`Rollback Soundness      : ${receipt.rollbackSoundnessVerified ? "PASS" : "FAIL"}`);
    console.log(`Post-Quantum HMAC       : ${receipt.postQuantumHmacVerified ? "PASS" : "FAIL"}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelPass ? "PASS" : "FAIL"}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_txfabric_route(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => !a.startsWith("--")) || "account:user-84920";

  const fabric = new EosShardedTransactionFabricCore();
  fabric.addShard("shard-alpha");
  fabric.addShard("shard-beta");
  fabric.addShard("shard-gamma");
  fabric.addShard("shard-delta");

  const routed = fabric.routeKey(keyArg);

  if (isJson) {
    console.log(JSON.stringify({ key: keyArg, ...routed }, null, 2));
  } else {
    console.log("=== Consistent Hash Ring Key Routing ===");
    console.log(`Key                     : ${keyArg}`);
    console.log(`Target Shard            : ${routed.shardId}`);
    console.log(`Assigned Vnode          : ${routed.vnodeId}`);
    console.log(`Token Digest            : ${routed.token.slice(0, 16)}...`);
  }
}

async function cmd_txfabric_commit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const fabric = new EosShardedTransactionFabricCore();
  fabric.addShard("shard-alpha");
  fabric.addShard("shard-beta");

  const receipt = fabric.executeTransaction({
    txId: "tx-cli-demo",
    readSnapshotTimestamp: 1000,
    writes: [
      { key: "account:sender", value: 400 },
      { key: "account:receiver", value: 100 },
    ],
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Distributed 2PC Atomic Commit ===");
    console.log(`Tx ID                   : ${receipt.txId}`);
    console.log(`Status                  : ${receipt.status}`);
    console.log(`Commit Timestamp        : ${receipt.commitTimestamp}`);
    console.log(`Shards Involved         : ${receipt.shardsInvolved.join(", ")}`);
    console.log(`HMAC-SHA384 Signature   : ${receipt.hmacSignature.slice(0, 16)}...`);
  }
}

HANDLERS["toolchain:txfabric:audit"] = cmd_txfabric_audit;
HANDLERS["toolchain:txfabric:route"] = cmd_txfabric_route;
HANDLERS["toolchain:txfabric:commit"] = cmd_txfabric_commit;

export async function handleShardedTransactionFabricCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:txfabric command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
