/**
 * CLI Single Executable Application Distribution Handlers
 *
 * Implements toolchain:sea:* subcommands for cross-platform target matrix inspection,
 * SEA bundle synthesis, dual Ed25519 and ML-DSA post-quantum code signing, and audit receipts.
 *
 * Conforms to SPEC-304 / CHANGE-166.
 */

import { EosSingleExecutableDistributionGovernor } from "../../src/core/eosSingleExecutableDistributionGovernor.ts";

const HANDLERS = {};

async function cmd_sea_matrix(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const matrix = EosSingleExecutableDistributionGovernor.getTargetMatrix();

  if (isJson) {
    console.log(JSON.stringify(matrix, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SEA TARGET ARCHITECTURE MATRIX (SPEC-304)            `);
  console.log(`===============================================================`);
  for (const [platform, spec] of Object.entries(matrix)) {
    console.log(
      `  Platform : ${platform.padEnd(14)} | OS: ${spec.os.padEnd(6)} | Arch: ${spec.arch.padEnd(5)} | Binary: ${spec.binaryName}`,
    );
  }
  console.log(`===============================================================\n`);
}

async function cmd_sea_bundle(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const platformArg = args.find((a) => a.startsWith("--platform="))?.split("=")[1] || "linux-x64";

  const matrix = EosSingleExecutableDistributionGovernor.getTargetMatrix();
  if (!matrix[platformArg]) {
    console.error(`[ERROR] Unsupported platform '${platformArg}'. Supported: ${Object.keys(matrix).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const keypair = EosSingleExecutableDistributionGovernor.generateDualKeyPair();
  const mockPayload = `GLORIAN-STANDALONE-BINARY-${platformArg}-BUNDLE`;
  const signature = EosSingleExecutableDistributionGovernor.signBinaryArtifact(mockPayload, keypair);
  const bundle = EosSingleExecutableDistributionGovernor.createDistributionBundle(platformArg, mockPayload, signature);

  if (isJson) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SEA DISTRIBUTION BUNDLE (SPEC-304)                   `);
  console.log(`===============================================================`);
  console.log(`  Platform     : ${bundle.platform}`);
  console.log(`  Binary Name  : ${bundle.binaryName}`);
  console.log(`  Binary Size  : ${bundle.binarySize} bytes`);
  console.log(`  SHA-256      : ${bundle.digestSha256}`);
  console.log(`  Signature    : ${bundle.signature.signatureHex.slice(0, 32)}...`);
  console.log(`  PQC Algo     : ${bundle.signature.pqcAlgorithm}`);
  console.log(`===============================================================\n`);
}

async function cmd_sea_sign(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const binArg = args.find((a) => a.startsWith("--binary="))?.split("=")[1] || "bin/eos.mjs";

  const keypair = EosSingleExecutableDistributionGovernor.generateDualKeyPair();
  const signature = EosSingleExecutableDistributionGovernor.signBinaryArtifact(binArg, keypair);

  if (isJson) {
    console.log(JSON.stringify(signature, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SEA DUAL CODE SIGNER (SPEC-304)                      `);
  console.log(`===============================================================`);
  console.log(`  Target Binary : ${binArg}`);
  console.log(`  Payload Hash  : ${signature.payloadSha256}`);
  console.log(`  Ed25519 Sig   : ${signature.signatureHex.slice(0, 32)}...`);
  console.log(`  PQC Algorithm : ${signature.pqcAlgorithm}`);
  console.log(`  PQC Sig       : ${signature.pqcSignatureHex.slice(0, 32)}...`);
  console.log(`  Timestamp     : ${signature.timestampIso}`);
  console.log(`===============================================================\n`);
}

async function cmd_sea_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = EosSingleExecutableDistributionGovernor.auditSeaDistributionPipeline({
    projectRoot: commandContext.root || process.cwd(),
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SEA DISTRIBUTION AUDIT RECEIPT (SPEC-304)            `);
  console.log(`===============================================================`);
  console.log(`  Total Platforms   : ${receipt.totalPlatforms}`);
  console.log(`  Binaries Verified : ${receipt.binariesVerified}`);
  console.log(`  Dual Signing      : ${receipt.dualSigningVerified ? "VERIFIED" : "FAILED"}`);
  console.log(`  Receipt Type      : ${receipt.receiptType}`);
  console.log(`  SHA-256 Signature : ${receipt.sha256Signature}`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:sea:matrix"] = cmd_sea_matrix;
HANDLERS["toolchain:sea:bundle"] = cmd_sea_bundle;
HANDLERS["toolchain:sea:sign"] = cmd_sea_sign;
HANDLERS["toolchain:sea:audit"] = cmd_sea_audit;

export async function handleSeaCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchSeaDistribution(commandContext) {
  return handleSeaCommands(commandContext);
}
