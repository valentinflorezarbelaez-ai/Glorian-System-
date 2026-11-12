import { EosPostQuantumMlDsaCore } from "../../src/core/eosPostQuantumMlDsaCore.ts";

const HANDLERS = {};

async function cmd_mldsa_keygen(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const keyPair = EosPostQuantumMlDsaCore.keyGen();

  if (isJson) {
    console.log(JSON.stringify(keyPair, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POST-QUANTUM DIGITAL SIGNATURE KEYGEN (SPEC-227)`);
  console.log(`===============================================================`);
  console.log(`  Algorithm              : ML-DSA-65 (NIST FIPS 204)`);
  console.log(`  Security Level         : Category 3 (AES-192 Equivalent)`);
  console.log(`  Public Key Bytes (Hex) : ${keyPair.publicKey.verificationKeyHex.length / 2} bytes`);
  console.log(`  Private Key Bytes (Hex): ${keyPair.privateKey.signingKeyHex.length / 2} bytes`);
  console.log(`  Rho Seed (Hex)         : ${keyPair.publicKey.rhoHex}`);
  console.log(`===============================================================\n`);
}

async function cmd_mldsa_sign(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const msgArg = args.find((a) => !a.startsWith("-")) || "Glorian Sovereign Sovereign Attestation";

  const keyPair = EosPostQuantumMlDsaCore.keyGen();
  const signature = EosPostQuantumMlDsaCore.sign(msgArg, keyPair.privateKey);

  const report = {
    algorithm: "ML-DSA-65",
    message: msgArg,
    signatureHex: signature.signatureHex,
    cTildeHex: signature.cTildeHex,
    publicKeyHex: keyPair.publicKey.verificationKeyHex,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POST-QUANTUM ML-DSA-65 DIGITAL SIGNATURE (SPEC-227)`);
  console.log(`===============================================================`);
  console.log(`  Message                : "${msgArg}"`);
  console.log(`  Algorithm              : ML-DSA-65 (NIST FIPS 204)`);
  console.log(`  Challenge Seed (c~)    : ${signature.cTildeHex}`);
  console.log(`  Signature Bytes (Hex)  : ${signature.signatureHex.length / 2} bytes`);
  console.log(`  Signature Hex Preview  : ${signature.signatureHex.slice(0, 64)}...`);
  console.log(`===============================================================\n`);
}

async function cmd_mldsa_verify(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const msgArg = args.find((a) => !a.startsWith("-")) || "Glorian Sovereign Attestation";

  const keyPair = EosPostQuantumMlDsaCore.keyGen();
  const signature = EosPostQuantumMlDsaCore.sign(msgArg, keyPair.privateKey);
  const isValid = EosPostQuantumMlDsaCore.verify(msgArg, signature, keyPair.publicKey);

  const report = {
    algorithm: "ML-DSA-65",
    message: msgArg,
    valid: isValid,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POST-QUANTUM SIGNATURE VERIFICATION (SPEC-227)`);
  console.log(`===============================================================`);
  console.log(`  Message                : "${msgArg}"`);
  console.log(`  Algorithm              : ML-DSA-65 (NIST FIPS 204)`);
  console.log(`  Verification Verdict   : ${isValid ? "PASS (VALID)" : "FAIL (INVALID)"}`);
  console.log(`===============================================================\n`);
}

HANDLERS["ml-dsa:keygen"] = cmd_mldsa_keygen;
HANDLERS["ml-dsa:sign"] = cmd_mldsa_sign;
HANDLERS["ml-dsa:verify"] = cmd_mldsa_verify;

export async function handleMlDsaCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
