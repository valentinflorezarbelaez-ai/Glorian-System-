/**
 * EOS SYSTEM — MULTI-REGION QUORUM LEASE & DISTRIBUTED LOCK CLI (Layer 0)
 * Governed by SPEC-284, CHANGE-146
 */

import fs from "node:fs";
import path from "node:path";
import { EosDistributedLockGovernor } from "../../src/core/eosDistributedLockGovernor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

export const HANDLERS = {};

const defaultGovernor = new EosDistributedLockGovernor();

function loadTopology(root) {
  const topoPath = path.join(root, "templates/locks/sample-cluster-topology.json");
  if (fs.existsSync(topoPath)) {
    try {
      const topo = JSON.parse(fs.readFileSync(topoPath, "utf8"));
      return new EosDistributedLockGovernor(topo);
    } catch {
      return defaultGovernor;
    }
  }
  return defaultGovernor;
}

async function cmd_toolchain_lock_acquire(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const resourceArg = args.slice(1).find((a) => !a.startsWith("-")) || "db-migration-lock";

  const ownerArg = args.find((a) => a.startsWith("--owner="));
  const owner = ownerArg ? ownerArg.split("=")[1] : "worker-alpha";

  const ttlArg = args.find((a) => a.startsWith("--ttl="));
  const ttlMs = ttlArg ? parseInt(ttlArg.split("=")[1], 10) : 5000;

  const governor = loadTopology(root);
  const result = governor.acquireLock(resourceArg, owner, ttlMs);

  let receiptSha = "";
  if (result.success && result.lease) {
    const receiptPath = resolveEvidencePath("DISTRIBUTED_LOCK_RECEIPT.json", root);
    const receipt = governor.generateReceipt(result.lease, receiptPath);
    receiptSha = receipt.sha256Signature;
  }

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          state: result.state,
          resource: resourceArg,
          owner,
          fencingToken: result.fencingToken,
          ttlMs,
          reason: result.reason,
          receiptSha256: receiptSha,
        },
        null,
        2,
      ),
    );
    if (!result.success) process.exitCode = 1;
    return;
  }

  console.log("======================================================================");
  console.log(" 🔒 GLORIAN SYSTEM — DISTRIBUTED QUORUM LOCK (SPEC-284)");
  console.log("======================================================================");
  console.log(` Resource      : ${resourceArg}`);
  console.log(` Requester     : ${owner}`);
  console.log(` Desired TTL   : ${ttlMs} ms`);
  console.log(` Status        : ${result.state}`);
  if (result.success) {
    console.log(` Fencing Token : ${result.fencingToken}`);
    console.log(` Quorum Votes  : ${result.lease?.quorumVotes}/${result.lease?.totalNodes} (Majority OK)`);
    console.log(` Signature     : ${receiptSha}`);
  } else {
    console.log(` Rejection     : ${result.reason}`);
    process.exitCode = 1;
  }
  console.log("======================================================================");
}

async function cmd_toolchain_lock_renew(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const resourceArg = args.slice(1).find((a) => !a.startsWith("-")) || "db-migration-lock";

  const ownerArg = args.find((a) => a.startsWith("--owner="));
  const owner = ownerArg ? ownerArg.split("=")[1] : "worker-alpha";

  const tokenArg = args.find((a) => a.startsWith("--token="));
  const token = tokenArg ? parseInt(tokenArg.split("=")[1], 10) : 1;

  const governor = loadTopology(root);
  // Auto-acquire before renew in CLI demo if unheld
  governor.acquireLock(resourceArg, owner, 5000);
  const result = governor.renewLock(resourceArg, owner, token);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return;
  }

  console.log("======================================================================");
  console.log(" 💓 GLORIAN SYSTEM — DISTRIBUTED LEASE RENEWAL (SPEC-284)");
  console.log("======================================================================");
  console.log(` Resource      : ${resourceArg}`);
  console.log(` Owner         : ${owner}`);
  console.log(` Fencing Token : ${token}`);
  console.log(` Result        : ${result.success ? "✅ LEASE RENEWED" : "❌ RENEWAL FAILED"}`);
  if (!result.success) {
    console.log(` Reason        : ${result.reason}`);
    process.exitCode = 1;
  }
  console.log("======================================================================");
}

async function cmd_toolchain_lock_release(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const resourceArg = args.slice(1).find((a) => !a.startsWith("-")) || "db-migration-lock";

  const ownerArg = args.find((a) => a.startsWith("--owner="));
  const owner = ownerArg ? ownerArg.split("=")[1] : "worker-alpha";

  const tokenArg = args.find((a) => a.startsWith("--token="));
  const token = tokenArg ? parseInt(tokenArg.split("=")[1], 10) : 1;

  const governor = loadTopology(root);
  // Auto-acquire before release in CLI demo if unheld
  governor.acquireLock(resourceArg, owner, 5000);
  const result = governor.releaseLock(resourceArg, owner, token);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return;
  }

  console.log("======================================================================");
  console.log(" 🔓 GLORIAN SYSTEM — DISTRIBUTED LOCK RELEASE (SPEC-284)");
  console.log("======================================================================");
  console.log(` Resource      : ${resourceArg}`);
  console.log(` Owner         : ${owner}`);
  console.log(` Fencing Token : ${token}`);
  console.log(` Result        : ${result.success ? "✅ LOCK RELEASED" : "❌ RELEASE FAILED"}`);
  if (!result.success) {
    console.log(` Reason        : ${result.reason}`);
    process.exitCode = 1;
  }
  console.log("======================================================================");
}

HANDLERS["toolchain:lock:acquire"] = cmd_toolchain_lock_acquire;
HANDLERS["toolchain:lock:renew"] = cmd_toolchain_lock_renew;
HANDLERS["toolchain:lock:release"] = cmd_toolchain_lock_release;

export async function handleLockCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
