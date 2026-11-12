import { EosVerifiableRandomFunctionCore } from "../../src/core/eosVerifiableRandomFunctionCore.ts";

const HANDLERS = {};

async function cmd_vrf_eval_160(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");
  const alphaArg = args.find((a) => a.startsWith("--alpha="));
  const alpha = alphaArg ? alphaArg.split("=")[1] : "epoch-slot-102";
  const thresholdArg = args.find((a) => a.startsWith("--threshold="));
  const threshold = thresholdArg ? parseFloat(thresholdArg.split("=")[1]) : 0.25;

  const keyPair = EosVerifiableRandomFunctionCore.generateKeyPair("deterministic-cli-vrf-seed");
  const evalRes = new EosVerifiableRandomFunctionCore().evaluate(keyPair.secretKey, alpha);

  if (command === "vrf:eval") {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            alpha,
            publicKeyHex: keyPair.publicKeyHex,
            gammaHex: evalRes.proof.gammaHex,
            cHex: evalRes.proof.cHex,
            sHex: evalRes.proof.sHex,
            beta: evalRes.beta,
            receipt: evalRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 VERIFIABLE RANDOM FUNCTION (SPEC-217)`);
    console.log(`===============================================================`);
    console.log(`  Input Alpha (Seed)   : "${alpha}"`);
    console.log(`  Public Key (PK)      : ${keyPair.publicKeyHex}`);
    console.log(`  VRF Point Gamma (Γ)  : ${evalRes.proof.gammaHex}`);
    console.log(`  Fiat-Shamir Challenge: 0x${evalRes.proof.cHex.slice(0, 16)}...`);
    console.log(`  Schnorr Response (s) : 0x${evalRes.proof.sHex.slice(0, 16)}...`);
    console.log(`  Pseudorandom Beta (β): sha256:${evalRes.beta}`);
    console.log(`  Receipt SHA-256      : sha256:${evalRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "vrf:verify") {
    const verifyRes = new EosVerifiableRandomFunctionCore().verify(keyPair.publicKey, alpha, evalRes.proof);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            alpha,
            valid: verifyRes.valid,
            beta: verifyRes.beta,
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
    console.log(`  GLORIAN LAYER-0 VRF VERIFICATION (SPEC-217)`);
    console.log(`===============================================================`);
    console.log(`  Input Alpha (Seed)   : "${alpha}"`);
    console.log(`  Verification Verdict : ${verifyRes.valid ? "VALID (UNFORGEABLE)" : "REJECTED"}`);
    console.log(`  Reconstructed Beta   : sha256:${verifyRes.beta}`);
    console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
    console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: vrf:elect
  const electRes = new EosVerifiableRandomFunctionCore().isElected(evalRes.beta, threshold);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          alpha,
          isElected: electRes.isElected,
          score: electRes.score,
          threshold: electRes.threshold,
          beta: electRes.beta,
          receipt: electRes.receipt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 VRF LEADER ELECTION (SPEC-217)`);
  console.log(`===============================================================`);
  console.log(`  Input Alpha (Seed)   : "${alpha}"`);
  console.log(`  Election Verdict     : ${electRes.isElected ? "ELECTED LEADER" : "NOT ELECTED"}`);
  console.log(`  Normalized Score     : ${electRes.score.toFixed(6)}`);
  console.log(`  Election Threshold   : ${electRes.threshold.toFixed(6)}`);
  console.log(`  Pseudorandom Beta    : sha256:${electRes.beta}`);
  console.log(`  Receipt SHA-256      : sha256:${electRes.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["vrf:eval"] = cmd_vrf_eval_160;
HANDLERS["vrf:verify"] = cmd_vrf_eval_160;
HANDLERS["vrf:elect"] = cmd_vrf_eval_160;

export async function handleVrfCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
