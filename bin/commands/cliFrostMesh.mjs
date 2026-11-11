import { EosFrostThresholdSignatureCore } from "../../src/core/eosFrostThresholdSignatureCore.ts";

const HANDLERS = {};

async function cmd_frost_mesh_162(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  const thresholdArg = args.find((a) => a.startsWith("--threshold="));
  const threshold = thresholdArg ? parseInt(thresholdArg.split("=")[1], 10) : 3;

  const signersArg = args.find((a) => a.startsWith("--signers="));
  const totalSigners = signersArg ? parseInt(signersArg.split("=")[1], 10) : 5;

  const msgArg = args.find((a) => a.startsWith("--message="));
  const message = msgArg ? msgArg.split("=")[1] : "consensus-tx-block-104";

  const seedArg = args.find((a) => a.startsWith("--seed="));
  const seed = seedArg ? seedArg.split("=")[1] : "deterministic-cli-frost-seed";

  const setupRes = EosFrostThresholdSignatureCore.setup(threshold, totalSigners, seed);
  const core = new EosFrostThresholdSignatureCore();

  if (command === "frost:keygen") {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            threshold,
            totalSigners,
            groupPublicKeyHex: setupRes.groupKey.groupPublicKeyHex,
            participantVerificationKeys: setupRes.groupKey.participantVerificationKeys,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 FROST THRESHOLD KEYGEN (SPEC-219)`);
    console.log(`===============================================================`);
    console.log(`  Threshold (t / n)    : ${threshold} of ${totalSigners} signers`);
    console.log(`  Group Public Key (PK): 0x${setupRes.groupKey.groupPublicKeyHex}`);
    console.log(`  Key Shares Generated : ${setupRes.keyShares.length} participant shares`);
    console.log(`===============================================================\n`);
    return;
  }

  // Active signers subset: first `threshold` signers
  const activeSubsetArg = args.find((a) => a.startsWith("--active="));
  const activeIds = activeSubsetArg
    ? activeSubsetArg
        .split("=")[1]
        .split(",")
        .map((x) => parseInt(x.trim(), 10))
    : setupRes.keyShares.slice(0, threshold).map((s) => s.participantId);

  const selectedShares = setupRes.keyShares.filter((s) => activeIds.includes(s.participantId));

  const signRes = core.sign(setupRes.groupKey, selectedShares, message, seed);

  if (command === "frost:sign") {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            message,
            threshold,
            activeSigners: activeIds,
            signatureHex: signRes.signatureHex,
            rHex: signRes.signature.rHex,
            zHex: signRes.signature.zHex,
            groupPublicKeyHex: signRes.groupPublicKeyHex,
            receipt: signRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 FROST THRESHOLD SIGNING (SPEC-219)`);
    console.log(`===============================================================`);
    console.log(`  Message Payload      : "${message}"`);
    console.log(`  Active Signers       : [${activeIds.join(", ")}]`);
    console.log(`  Group Commitment (R) : 0x${signRes.signature.rHex}`);
    console.log(`  Aggregated Scalar (z): 0x${signRes.signature.zHex}`);
    console.log(`  Unified Signature Hex: 0x${signRes.signatureHex}`);
    console.log(`  Receipt SHA-256      : sha256:${signRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: frost:verify
  const verifyRes = core.verify(setupRes.groupKey.groupPublicKey, message, signRes.signature);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          message,
          valid: verifyRes.valid,
          groupPublicKeyHex: setupRes.groupKey.groupPublicKeyHex,
          signatureHex: signRes.signatureHex,
          verificationTimeMs: verifyRes.verificationTimeMs,
          receipt: verifyRes.receipt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 FROST SCHNORR VERIFICATION (SPEC-219)`);
  console.log(`===============================================================`);
  console.log(`  Message Payload      : "${message}"`);
  console.log(`  Group Public Key (PK): 0x${setupRes.groupKey.groupPublicKeyHex}`);
  console.log(`  Verification Verdict : ${verifyRes.valid ? "VALID (THRESHOLD AUTHENTIC)" : "REJECTED"}`);
  console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
  console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["frost:keygen"] = cmd_frost_mesh_162;
HANDLERS["frost:sign"] = cmd_frost_mesh_162;
HANDLERS["frost:verify"] = cmd_frost_mesh_162;

export async function handleFrostCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
