import { EosSparseMerkleTreeCore } from "../../src/core/eosSparseMerkleTreeCore.ts";

const HANDLERS = {};

async function cmd_smt_mesh_161(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => a.startsWith("--key="));
  const key = keyArg ? keyArg.split("=")[1] : "tenant-001";
  const valueArg = args.find((a) => a.startsWith("--value="));
  const value = valueArg ? valueArg.split("=")[1] : "state-active";

  const smt = new EosSparseMerkleTreeCore();
  smt.set("tenant-001", "state-active");
  smt.set("tenant-002", "state-standby");
  smt.set("tenant-003", "state-revoked");

  if (command === "smt:set") {
    const setRes = smt.set(key, value);
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            key,
            value,
            root: setRes.root,
            leafCount: setRes.leafCount,
            receipt: setRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 SPARSE MERKLE TREE MUTATION (SPEC-218)`);
    console.log(`===============================================================`);
    console.log(`  Target Key           : "${key}"`);
    console.log(`  Stored Value         : "${value}"`);
    console.log(`  Total Active Leaves  : ${setRes.leafCount} leaves`);
    console.log(`  Canonical SMT Root   : sha256:${setRes.root}`);
    console.log(`  Receipt SHA-256      : sha256:${setRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "smt:verify") {
    const proof = smt.getProof(key);
    const verifyRes = smt.verifyProof(proof);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            key,
            proofType: proof.proofType,
            valid: verifyRes.valid,
            verificationTimeMs: verifyRes.verificationTimeMs,
            root: proof.root,
            receipt: verifyRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 SMT PROOF VERIFICATION (SPEC-218)`);
    console.log(`===============================================================`);
    console.log(`  Target Key           : "${key}"`);
    console.log(`  Proof Type           : ${proof.proofType.toUpperCase()}`);
    console.log(`  Verification Verdict : ${verifyRes.valid ? "VALID (PROVABLY AUTHENTIC)" : "REJECTED"}`);
    console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
    console.log(`  Canonical Root       : sha256:${proof.root}`);
    console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: smt:prove
  const proof = smt.getProof(key);
  const verifyRes = smt.verifyProof(proof);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          key,
          proofType: proof.proofType,
          value: proof.value,
          nonMembershipReason: proof.nonMembershipReason,
          conflictingKey: proof.conflictingKey,
          siblingCount: proof.siblings.length,
          root: proof.root,
          valid: verifyRes.valid,
          receipt: verifyRes.receipt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 SMT PROOF GENERATION (SPEC-218)`);
  console.log(`===============================================================`);
  console.log(`  Target Key           : "${key}"`);
  console.log(`  Proof Type           : ${proof.proofType.toUpperCase()}`);
  if (proof.proofType === "membership") {
    console.log(`  Value Proven         : "${proof.value}"`);
  } else {
    console.log(`  Exclusion Reason     : ${proof.nonMembershipReason}`);
    if (proof.conflictingKey) {
      console.log(`  Conflicting Key      : "${proof.conflictingKey}"`);
    }
  }
  console.log(`  Sibling Path Length  : ${proof.siblings.length} nodes`);
  console.log(`  Canonical Root       : sha256:${proof.root}`);
  console.log(`  In-Memory Verified   : ${verifyRes.valid ? "YES" : "NO"}`);
  console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["smt:set"] = cmd_smt_mesh_161;
HANDLERS["smt:prove"] = cmd_smt_mesh_161;
HANDLERS["smt:verify"] = cmd_smt_mesh_161;

export async function handleSmtCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
