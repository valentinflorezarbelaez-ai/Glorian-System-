import { EosZeroKnowledgeR1csCore } from "../../src/core/eosZeroKnowledgeR1csCore.ts";

const HANDLERS = {};

async function cmd_zk_r1cs_157(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");
  const secretArg = args.find((a) => a.startsWith("--secret="));
  const secretVal = secretArg ? BigInt(secretArg.split("=")[1]) : 3n;

  const core = new EosZeroKnowledgeR1csCore();
  const { system, witness } = core.synthesizeExampleCircuit(secretVal);

  if (command === "r1cs:synthesize") {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            numVariables: system.numVariables,
            numConstraints: system.numConstraints,
            publicInputCount: system.publicInputCount,
            variableNames: system.variableNames,
            witnessValues: witness.values.map((v) => v.toString()),
            witnessCommitment: witness.witnessCommitment,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 ZERO-KNOWLEDGE R1CS SYNTHESIS (SPEC-214)`);
    console.log(`===============================================================`);
    console.log(`  Variables (wires)    : ${system.numVariables} (${system.variableNames.join(", ")})`);
    console.log(`  Constraints (gates)  : ${system.numConstraints} quadratic multiplication constraints`);
    console.log(`  Public Inputs        : ${system.publicInputCount} (out = ${witness.values[1]})`);
    console.log(`  Witness Secret (x)   : ${witness.values[2]}`);
    console.log(`  Witness Commitment   : sha256:${witness.witnessCommitment}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "r1cs:verify") {
    const proof = core.prove(system, witness.values);
    const verifyRes = core.verify(system, [witness.values[1]], proof);
    if (isJson) {
      console.log(JSON.stringify(verifyRes, null, 2));
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 ZERO-KNOWLEDGE QAP VERIFICATION (SPEC-214)`);
    console.log(`===============================================================`);
    console.log(`  Verification Verdict : ${verifyRes.valid ? "SATISFIED (VALID ARGUMENT)" : "FORGED"}`);
    console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
    console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: r1cs:prove
  const proof = core.prove(system, witness.values);
  if (isJson) {
    console.log(
      JSON.stringify(
        {
          tau: proof.tau.toString(),
          aTau: proof.aTau.toString(),
          bTau: proof.bTau.toString(),
          cTau: proof.cTau.toString(),
          hTau: proof.hTau.toString(),
          tTau: proof.tTau.toString(),
          proofDigest: proof.proofDigest,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 ZERO-KNOWLEDGE QAP PROOF GENERATION (SPEC-214)`);
  console.log(`===============================================================`);
  console.log(`  Fiat-Shamir Tau (τ)  : ${proof.tau.toString().slice(0, 16)}...`);
  console.log(`  Polynomial A(τ)      : ${proof.aTau.toString().slice(0, 16)}...`);
  console.log(`  Polynomial B(τ)      : ${proof.bTau.toString().slice(0, 16)}...`);
  console.log(`  Polynomial C(τ)      : ${proof.cTau.toString().slice(0, 16)}...`);
  console.log(`  Quotient H(τ)        : ${proof.hTau.toString().slice(0, 16)}...`);
  console.log(`  Target Divisor T(τ)  : ${proof.tTau.toString().slice(0, 16)}...`);
  console.log(`  Proof Digest         : sha256:${proof.proofDigest}`);
  console.log(`===============================================================\n`);
}

HANDLERS["r1cs:synthesize"] = cmd_zk_r1cs_157;
HANDLERS["r1cs:prove"] = cmd_zk_r1cs_157;
HANDLERS["r1cs:verify"] = cmd_zk_r1cs_157;

export async function handleZkR1csCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
