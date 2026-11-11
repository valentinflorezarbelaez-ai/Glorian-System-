import { EosKzgPolynomialCommitmentCore } from "../../src/core/eosKzgPolynomialCommitmentCore.ts";

const HANDLERS = {};

async function cmd_kzg_mesh_163(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  const coeffsArg = args.find((a) => a.startsWith("--coeffs="));
  const coeffs = coeffsArg
    ? coeffsArg
        .split("=")[1]
        .split(",")
        .map((x) => BigInt(x.trim()))
    : [7n, 5n, 2n, 3n]; // 3x^3 + 2x^2 + 5x + 7

  const pointArg = args.find((a) => a.startsWith("--point="));
  const z = pointArg ? BigInt(pointArg.split("=")[1]) : 4n;

  const pointsArg = args.find((a) => a.startsWith("--points="));
  const points = pointsArg
    ? pointsArg
        .split("=")[1]
        .split(",")
        .map((x) => BigInt(x.trim()))
    : [2n, 3n, 5n];

  const seedArg = args.find((a) => a.startsWith("--seed="));
  const seed = seedArg ? seedArg.split("=")[1] : "cli-deterministic-kzg-seed";

  const srs = EosKzgPolynomialCommitmentCore.setup(16, seed);
  const core = new EosKzgPolynomialCommitmentCore(srs);

  if (command === "kzg:commit") {
    const commitRes = core.commit(coeffs);
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            degree: commitRes.degree,
            coefficients: coeffs.map((c) => c.toString()),
            commitmentHex: commitRes.commitmentHex,
            receipt: commitRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 KZG POLYNOMIAL COMMITMENT (SPEC-220)`);
    console.log(`===============================================================`);
    console.log(`  Polynomial Degree    : ${commitRes.degree}`);
    console.log(`  Coefficients [c0..cd]: [${coeffs.map((c) => c.toString()).join(", ")}]`);
    console.log(`  KZG Commitment (C)   : 0x${commitRes.commitmentHex}`);
    console.log(`  Commitment Size      : 33 bytes (compressed affine point)`);
    console.log(`  Receipt SHA-256      : sha256:${commitRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "kzg:open") {
    const commitRes = core.commit(coeffs);
    const openRes = core.open(coeffs, z);
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            evaluationPoint: openRes.evaluationPoint.toString(),
            claimedValue: openRes.claimedValue.toString(),
            proofHex: openRes.proofHex,
            quotientDegree: openRes.quotientDegree,
            commitmentHex: commitRes.commitmentHex,
            receipt: openRes.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 KZG EVALUATION OPENING (SPEC-220)`);
    console.log(`===============================================================`);
    console.log(`  Evaluation Point (z) : ${openRes.evaluationPoint.toString()}`);
    console.log(`  Claimed Value v=p(z) : ${openRes.claimedValue.toString()}`);
    console.log(`  Quotient Degree      : ${openRes.quotientDegree}`);
    console.log(`  KZG Proof Point (π)  : 0x${openRes.proofHex}`);
    console.log(`  Parent Commitment (C): 0x${commitRes.commitmentHex}`);
    console.log(`  Receipt SHA-256      : sha256:${openRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "kzg:batch") {
    const commitRes = core.commit(coeffs);
    const batchProof = core.openBatch(coeffs, points);
    const verifyRes = core.verifyBatch(
      commitRes.commitmentPoint,
      batchProof.evaluationPoints,
      batchProof.claimedValues,
      batchProof,
    );

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            points: batchProof.evaluationPoints.map((p) => p.toString()),
            values: batchProof.claimedValues.map((v) => v.toString()),
            proofHex: batchProof.proofHex,
            valid: verifyRes.valid,
            verificationTimeMs: verifyRes.verificationTimeMs,
            receipt: batchProof.receipt,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 KZG BATCHED MULTI-POINT PROOF (SPEC-220)`);
    console.log(`===============================================================`);
    console.log(`  Evaluation Points    : [${batchProof.evaluationPoints.map((p) => p.toString()).join(", ")}]`);
    console.log(`  Claimed Values       : [${batchProof.claimedValues.map((v) => v.toString()).join(", ")}]`);
    console.log(`  Batched Proof (π)    : 0x${batchProof.proofHex}`);
    console.log(`  Batched Verification : ${verifyRes.valid ? "VALID (AUTHENTIC)" : "REJECTED"}`);
    console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
    console.log(`  Receipt SHA-256      : sha256:${batchProof.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: kzg:verify
  const commitRes = core.commit(coeffs);
  const openRes = core.open(coeffs, z);
  const verifyRes = core.verify(
    commitRes.commitmentPoint,
    z,
    openRes.claimedValue,
    openRes.proofPoint,
    openRes.quotientDegree,
  );

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          evaluationPoint: z.toString(),
          claimedValue: openRes.claimedValue.toString(),
          valid: verifyRes.valid,
          verificationTimeMs: verifyRes.verificationTimeMs,
          commitmentHex: commitRes.commitmentHex,
          proofHex: openRes.proofHex,
          receipt: verifyRes.receipt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN LAYER-0 KZG PROOF VERIFICATION (SPEC-220)`);
  console.log(`===============================================================`);
  console.log(`  Evaluation Point (z) : ${z.toString()}`);
  console.log(`  Claimed Value v=p(z) : ${openRes.claimedValue.toString()}`);
  console.log(`  Verification Verdict : ${verifyRes.valid ? "VALID (O(1) CONSTANT-SIZE PROOF)" : "REJECTED"}`);
  console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
  console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["kzg:commit"] = cmd_kzg_mesh_163;
HANDLERS["kzg:open"] = cmd_kzg_mesh_163;
HANDLERS["kzg:verify"] = cmd_kzg_mesh_163;
HANDLERS["kzg:batch"] = cmd_kzg_mesh_163;

export async function handleKzgCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
