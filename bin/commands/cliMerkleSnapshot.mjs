/**
 * EOS SYSTEM — MERKLE SNAPSHOT & ZERO-KNOWLEDGE PROOF CLI (Layer 0)
 * Governed by SPEC-282, CHANGE-144
 */

import fs from "node:fs";
import path from "node:path";
import { EosMerkleSnapshotGovernor } from "../../src/core/eosMerkleSnapshotGovernor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

export const HANDLERS = {};

async function cmd_toolchain_merkle_build(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/snapshots/sample-state-snapshot.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const tree = EosMerkleSnapshotGovernor.buildTree(Array.isArray(items) ? items : [items]);
  const receiptPath = resolveEvidencePath("MERKLE_SNAPSHOT_RECEIPT.json", root);
  const receipt = EosMerkleSnapshotGovernor.generateReceipt(tree, receiptPath);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          snapshotId: tree.snapshotId,
          rootHash: tree.rootHash,
          leafCount: tree.leafCount,
          depth: tree.depth,
          receiptPath,
          receiptSha256: receipt.sha256Signature,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" 🌳 GLORIAN SYSTEM — MERKLE TREE SNAPSHOT GOVERNOR (SPEC-282)");
  console.log("======================================================================");
  console.log(` Snapshot ID : ${tree.snapshotId}`);
  console.log(` Leaves      : ${tree.leafCount}`);
  console.log(` Tree Depth  : ${tree.depth}`);
  console.log(` Merkle Root : ${tree.rootHash}`);
  console.log(` Receipt     : ${receiptPath}`);
  console.log(` Signature   : ${receipt.sha256Signature}`);
  console.log("======================================================================");
}

async function cmd_toolchain_merkle_proof(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/snapshots/sample-state-snapshot.json";

  const indexArg = args.find((a) => a.startsWith("--index="));
  const leafIndex = indexArg ? parseInt(indexArg.split("=")[1], 10) : 0;

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const tree = EosMerkleSnapshotGovernor.buildTree(Array.isArray(items) ? items : [items]);
  const proof = EosMerkleSnapshotGovernor.generateProof(tree, leafIndex);

  if (isJson) {
    console.log(JSON.stringify(proof, null, 2));
    return;
  }

  console.log("======================================================================");
  console.log(" 🔍 GLORIAN SYSTEM — MERKLE INCLUSION PROOF (SPEC-282)");
  console.log("======================================================================");
  console.log(` Leaf Index  : ${proof.leafIndex}`);
  console.log(` Leaf Hash   : ${proof.leafHash}`);
  console.log(` Merkle Root : ${proof.rootHash}`);
  console.log(` Steps Count : ${proof.proof.length}`);
  proof.proof.forEach((p, idx) => {
    console.log(`   Step ${idx + 1}   : [${p.position}] ${p.siblingHash}`);
  });
  console.log("======================================================================");
}

async function cmd_toolchain_merkle_verify(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/snapshots/sample-state-snapshot.json";

  const indexArg = args.find((a) => a.startsWith("--index="));
  const leafIndex = indexArg ? parseInt(indexArg.split("=")[1], 10) : 0;

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rawItems = Array.isArray(items) ? items : [items];
  const tree = EosMerkleSnapshotGovernor.buildTree(rawItems);
  const targetLeaf = rawItems[leafIndex];
  const proof = EosMerkleSnapshotGovernor.generateProof(tree, leafIndex);
  const valid = EosMerkleSnapshotGovernor.verifyProof(targetLeaf, proof);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          valid,
          leafIndex,
          rootHash: proof.rootHash,
          leafHash: proof.leafHash,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" 🛡️ GLORIAN SYSTEM — MERKLE PROOF VERIFIER (SPEC-282)");
  console.log("======================================================================");
  console.log(` Leaf Index  : ${leafIndex}`);
  console.log(` Merkle Root : ${proof.rootHash}`);
  console.log(` Verification: ${valid ? "✅ VALID INCLUSION PROOF" : "❌ INVALID PROOF"}`);
  console.log("======================================================================");
}

HANDLERS["toolchain:merkle:build"] = cmd_toolchain_merkle_build;
HANDLERS["toolchain:merkle:proof"] = cmd_toolchain_merkle_proof;
HANDLERS["toolchain:merkle:verify"] = cmd_toolchain_merkle_verify;

export async function handleMerkleCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
