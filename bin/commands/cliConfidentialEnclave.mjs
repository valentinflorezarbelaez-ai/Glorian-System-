/**
 * CLI Confidential Computing in Hardware TEEs Handlers
 *
 * Implements toolchain:enclave:* subcommands for Platform Configuration Register
 * measurements, remote attestation, hardware-bound secret sealing, and audit receipts.
 *
 * Conforms to SPEC-301 / CHANGE-163.
 */

import { EosConfidentialEnclaveGovernor } from "../../src/core/eosConfidentialEnclaveGovernor.ts";

const HANDLERS = {};

const DEFAULT_ENCLAVE_DEF = {
  enclaveId: "enclave-nitro-release-01",
  imageBinaryOrPath: "eos-core-kernel-image-v75.0.0",
  bootArgs: "console=ttyS0 root=/dev/ram0 quiet",
  applicationBundle: "eos-system-dist-bundle-sha256-precomputed",
  iamRoleArnOrContext: "arn:aws:iam::123456789012:role/eos-sovereign-deployer",
};

async function cmd_enclave_attest(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nonceArg = args.find((a) => a.startsWith("--nonce="))?.split("=")[1] || "fresh-challenge-nonce-12345678";

  const attestation = EosConfidentialEnclaveGovernor.generateAttestationDocument(DEFAULT_ENCLAVE_DEF, nonceArg);
  const pcrs = attestation.pcrs;
  const verification = EosConfidentialEnclaveGovernor.verifyAttestationDocument(attestation, pcrs, nonceArg);

  const output = {
    enclaveId: attestation.enclaveId,
    timestampIso: attestation.timestampIso,
    nonce: attestation.nonce,
    pcrs: attestation.pcrs,
    signatureVerified: verification.signatureVerified,
    attestationVerdict: verification.verdict,
    valid: verification.valid,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🛡️  EOS HARDWARE ENCLAVE REMOTE ATTESTATION (SPEC-301)        ");
  console.log("===============================================================");
  console.log(`  Enclave ID          : ${output.enclaveId}`);
  console.log(`  Timestamp           : ${output.timestampIso}`);
  console.log(`  Nonce               : ${output.nonce}`);
  console.log("---------------------------------------------------------------");
  console.log("  PLATFORM CONFIGURATION REGISTERS (PCRs):");
  console.log(`    ↳ PCR0 (Image)    : ${output.pcrs.pcr0}`);
  console.log(`    ↳ PCR1 (BootArgs) : ${output.pcrs.pcr1}`);
  console.log(`    ↳ PCR2 (AppBundle): ${output.pcrs.pcr2}`);
  console.log(`    ↳ PCR8 (IAM/Role) : ${output.pcrs.pcr8}`);
  console.log("---------------------------------------------------------------");
  console.log(`  RoT Signature Valid : ${output.signatureVerified ? "YES (Ed25519 Verified)" : "NO"}`);
  console.log(`  Attestation Verdict : ${output.attestationVerdict}`);
  console.log(`  Overall Status      : ${output.valid ? "CONFORMING (PASS)" : "REJECTED (FAIL)"}`);
  console.log("===============================================================\n");
}

async function cmd_enclave_seal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const secretArg = args.find((a) => a.startsWith("--secret="))?.split("=")[1] || "SOVEREIGN_MASTER_DEPLOY_SECRET_2026";

  const pcrs = EosConfidentialEnclaveGovernor.computePcrRegisters(DEFAULT_ENCLAVE_DEF);
  const sealed = EosConfidentialEnclaveGovernor.sealSecret(secretArg, pcrs);

  if (isJson) {
    console.log(JSON.stringify(sealed, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS HARDWARE-BOUND SECRET SEALING (SPEC-301)              ");
  console.log("===============================================================");
  console.log(`  Algorithm           : ${sealed.algorithm}`);
  console.log(`  Key Derivation      : ${sealed.keyDerivation}`);
  console.log(`  Bound PCR0          : ${sealed.boundPcrs.pcr0.slice(0, 24)}...`);
  console.log(`  Bound PCR2          : ${sealed.boundPcrs.pcr2.slice(0, 24)}...`);
  console.log(`  IV (12 bytes)       : ${sealed.ivHex}`);
  console.log(`  Auth Tag (16 bytes) : ${sealed.authTagHex}`);
  console.log(`  Ciphertext Length   : ${sealed.ciphertextHex.length / 2} bytes`);
  console.log("===============================================================\n");
}

async function cmd_enclave_unseal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const secret = "SOVEREIGN_RELEASE_SIGNING_KEY_ED25519_SECRET_MATERIAL";

  const pcrs = EosConfidentialEnclaveGovernor.computePcrRegisters(DEFAULT_ENCLAVE_DEF);
  const sealed = EosConfidentialEnclaveGovernor.sealSecret(secret, pcrs);
  const unsealed = EosConfidentialEnclaveGovernor.unsealSecret(sealed, pcrs);

  const output = {
    unsealedSuccessfully: unsealed === secret,
    plaintextPayload: unsealed,
    boundPcr0: sealed.boundPcrs.pcr0,
    boundPcr2: sealed.boundPcrs.pcr2,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔓  EOS ENCLAVE SECRET UNSEAL VERIFICATION (SPEC-301)         ");
  console.log("===============================================================");
  console.log(`  Unsealed Status     : ${output.unsealedSuccessfully ? "SUCCESS (Matched)" : "FAILED"}`);
  console.log(`  Recovered Plaintext : ${output.plaintextPayload}`);
  console.log("===============================================================\n");
}

async function cmd_enclave_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const projectRoot = commandContext.projectRoot || process.cwd();

  const receipt = EosConfidentialEnclaveGovernor.auditConfidentialEnclavePipeline({ projectRoot });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🛡️  EOS HARDWARE TEE AUDIT RECEIPT (SPEC-301)                ");
  console.log("===============================================================");
  console.log(`  Timestamp           : ${receipt.timestampIso}`);
  console.log(`  Spec Reference      : ${receipt.specRef}`);
  console.log(`  Enclaves Audited    : ${receipt.totalEnclavesAudited}`);
  console.log(`  Attestation Valid   : ${receipt.attestationValid}`);
  console.log(`  Sealing Verified    : ${receipt.sealingVerified}`);
  console.log(`  PCR Integrity Guard : ${receipt.pcrIntegrityGuarded}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:enclave:attest"] = cmd_enclave_attest;
HANDLERS["toolchain:enclave:seal"] = cmd_enclave_seal;
HANDLERS["toolchain:enclave:unseal"] = cmd_enclave_unseal;
HANDLERS["toolchain:enclave:verify"] = cmd_enclave_verify;

export async function handleEnclaveCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchConfidentialEnclaveCommand(commandContext) {
  return handleEnclaveCommands(commandContext);
}
