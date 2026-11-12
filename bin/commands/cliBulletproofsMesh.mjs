import { EosBulletproofsRangeProofCore } from "../../src/core/eosBulletproofsRangeProofCore.ts";

const HANDLERS = {};

async function cmd_bp_mesh_165(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  if (command === "bp:commit") {
    const valArg = args.find((a) => a.startsWith("--value="));
    const gammaArg = args.find((a) => a.startsWith("--gamma="));

    const value = valArg ? BigInt(valArg.split("=")[1]) : 42000n;
    const gamma = gammaArg ? BigInt(gammaArg.split("=")[1]) : undefined;

    const comm = EosBulletproofsRangeProofCore.commit(value, gamma);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "Bulletproofs Pedersen Commitment",
            curve: "secp256k1",
            value: comm.value.toString(),
            gamma: comm.gamma.toString(16),
            pointHex: comm.pointHex,
            point: {
              x: comm.point.x.toString(16),
              y: comm.point.y.toString(16),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN BULLETPROOFS PEDERSEN COMMITMENT (SPEC-222)`);
    console.log(`===============================================================`);
    console.log(`  Curve                : secp256k1 (zero trusted setup)`);
    console.log(`  Committed Value (v)  : ${comm.value}`);
    console.log(`  Blinding Factor (γ)  : ${comm.gamma.toString(16).slice(0, 32)}...`);
    console.log(`  Commitment Point (V) : ${comm.pointHex}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "bp:prove") {
    const valArg = args.find((a) => a.startsWith("--value="));
    const mArg = args.find((a) => a.startsWith("--m="));
    const gammaArg = args.find((a) => a.startsWith("--gamma="));

    const bitLength = mArg ? parseInt(mArg.split("=")[1], 10) : 32;
    const value = valArg ? BigInt(valArg.split("=")[1]) : 42000n;
    const gamma = gammaArg ? BigInt(gammaArg.split("=")[1]) : undefined;

    const t0 = performance.now();
    const proof = EosBulletproofsRangeProofCore.prove(value, gamma, bitLength);
    const elapsed = (performance.now() - t0).toFixed(2);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            algorithm: "Bulletproofs NIZK Range Proof",
            curve: "secp256k1",
            bitLength: proof.bitLength,
            range: `[0, 2^${proof.bitLength} - 1]`,
            commitmentHex: proof.commitmentHex,
            tauX: proof.tauX.toString(16),
            mu: proof.mu.toString(16),
            tHat: proof.tHat.toString(16),
            innerProductRounds: proof.ipProof.L.length,
            ipScalarA: proof.ipProof.a.toString(16),
            ipScalarB: proof.ipProof.b.toString(16),
            proofSha256: proof.proofSha256,
            proverTimeMs: parseFloat(elapsed),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN BULLETPROOFS RANGE PROOF GENERATED (SPEC-222)`);
    console.log(`===============================================================`);
    console.log(`  Bit Length (m)       : ${proof.bitLength} bits (Range [0, 2^${proof.bitLength} - 1])`);
    console.log(`  Pedersen Commitment  : ${proof.commitmentHex}`);
    console.log(`  Proof Elements       : ${2 * proof.ipProof.L.length + 4} curve points, 5 scalars`);
    console.log(`  Inner Product Rounds : ${proof.ipProof.L.length} (Logarithmic O(log m))`);
    console.log(`  Proof SHA-256        : sha256:${proof.proofSha256}`);
    console.log(`  Prover Duration      : ${elapsed} ms`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "bp:verify") {
    const valArg = args.find((a) => a.startsWith("--value="));
    const mArg = args.find((a) => a.startsWith("--m="));

    const bitLength = mArg ? parseInt(mArg.split("=")[1], 10) : 32;
    const value = valArg ? BigInt(valArg.split("=")[1]) : 42000n;

    const proof = EosBulletproofsRangeProofCore.prove(value, undefined, bitLength);
    const result = EosBulletproofsRangeProofCore.verify(proof);

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN BULLETPROOFS RANGE PROOF VERIFICATION (SPEC-222)`);
    console.log(`===============================================================`);
    console.log(`  Verification Result  : ${result.valid ? "VALID (SOUND & ZERO-KNOWLEDGE)" : "INVALID"}`);
    console.log(`  Bit Length (m)       : ${result.bitLength} bits`);
    console.log(`  Verification Time    : ${result.verificationTimeMs} ms`);
    console.log(`  Receipt ID           : ${result.receipt.receiptId}`);
    console.log(`  Receipt SHA-256      : sha256:${result.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "bp:benchmark") {
    const itersArg = args.find((a) => a.startsWith("--iterations="));
    const mArg = args.find((a) => a.startsWith("--m="));

    const iterations = itersArg ? parseInt(itersArg.split("=")[1], 10) : 5;
    const bitLength = mArg ? parseInt(mArg.split("=")[1], 10) : 16;

    const bench = EosBulletproofsRangeProofCore.benchmark(iterations, bitLength);

    if (isJson) {
      console.log(JSON.stringify(bench, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN BULLETPROOFS PERFORMANCE BENCHMARK (SPEC-222)`);
    console.log(`===============================================================`);
    console.log(`  Bit Length (m)       : ${bench.bitLength} bits`);
    console.log(`  Iterations           : ${bench.iterations}`);
    console.log(`  Commit Throughput    : ${bench.commitOpsPerSec} ops/sec`);
    console.log(`  Prove Throughput     : ${bench.proveOpsPerSec} ops/sec (~${bench.averageProveTimeMs} ms/op)`);
    console.log(`  Verify Throughput    : ${bench.verifyOpsPerSec} ops/sec (~${bench.averageVerifyTimeMs} ms/op)`);
    console.log(`  Receipt SHA-256      : sha256:${bench.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }
}

HANDLERS["bp:commit"] = cmd_bp_mesh_165;
HANDLERS["bp:prove"] = cmd_bp_mesh_165;
HANDLERS["bp:verify"] = cmd_bp_mesh_165;
HANDLERS["bp:benchmark"] = cmd_bp_mesh_165;

export async function handleBulletproofsCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
