import { EosMerkleMountainRangeCore } from "../../src/core/eosMerkleMountainRangeCore.ts";

const HANDLERS = {};

async function cmd_mmr_accum_159(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");
  const leafArg = args.find((a) => a.startsWith("--leaf="));
  const leafIdx = leafArg ? parseInt(leafArg.split("=")[1], 10) : 2;
  const countArg = args.find((a) => a.startsWith("--count="));
  const count = countArg ? parseInt(countArg.split("=")[1], 10) : 7;

  const mmr = new EosMerkleMountainRangeCore();
  for (let i = 0; i < count; i++) {
    mmr.append(`tx-entry-${i}`);
  }

  if (command === "mmr:append") {
    const appendRes = mmr.append(`tx-entry-${count}`);
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            leafIndex: appendRes.leafIndex,
            leafPos: appendRes.leafPos,
            leafHash: appendRes.leafHash,
            mmrSize: appendRes.mmrSize,
            root: appendRes.root,
            peaks: mmr.getPeaks(),
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 MERKLE MOUNTAIN RANGE APPEND (SPEC-216)`);
    console.log(`===============================================================`);
    console.log(`  Appended Leaf Index  : ${appendRes.leafIndex}`);
    console.log(`  Node Position (pos)  : ${appendRes.leafPos}`);
    console.log(`  Total MMR Nodes      : ${appendRes.mmrSize}`);
    console.log(`  Active Mountain Peaks: ${mmr.getPeaks().length} peaks`);
    console.log(`  Canonical MMR Root   : sha256:${appendRes.root}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "mmr:verify") {
    const validIdx = Math.min(leafIdx, mmr.getLeafCount() - 1);
    const proof = mmr.getInclusionProof(validIdx);
    const verifyRes = mmr.verifyInclusion(proof);

    if (isJson) {
      console.log(JSON.stringify(verifyRes, null, 2));
      return;
    }
    console.log(`\n===============================================================`);
    console.log(`  GLORIAN LAYER-0 MMR INCLUSION VERIFICATION (SPEC-216)`);
    console.log(`===============================================================`);
    console.log(`  Target Leaf Index    : ${validIdx}`);
    console.log(`  Verification Verdict : ${verifyRes.valid ? "VALID (PROVABLY INCLUDED)" : "REJECTED"}`);
    console.log(`  Verification Time    : ${verifyRes.verificationTimeMs.toFixed(3)} ms`);
    console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  // Default: mmr:prove
  const validIdx = Math.min(leafIdx, mmr.getLeafCount() - 1);
  const proof = mmr.getInclusionProof(validIdx);
  const verifyRes = mmr.verifyInclusion(proof);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          leafIndex: proof.leafIndex,
          leafPos: proof.leafPos,
          leafHash: proof.leafHash,
          mmrSize: proof.mmrSize,
          siblingCount: proof.siblings.length,
          peakCount: proof.peaks.length,
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
  console.log(`  GLORIAN LAYER-0 MMR PROOF GENERATION (SPEC-216)`);
  console.log(`===============================================================`);
  console.log(`  Target Leaf Index    : ${proof.leafIndex}`);
  console.log(`  Leaf Hash            : sha256:${proof.leafHash}`);
  console.log(`  Proof Sibling Path   : ${proof.siblings.length} hashes`);
  console.log(`  Bag-of-Peaks Count   : ${proof.peaks.length} peaks`);
  console.log(`  Canonical MMR Root   : sha256:${proof.root}`);
  console.log(`  Verified In-Memory   : ${verifyRes.valid ? "YES" : "NO"}`);
  console.log(`  Receipt SHA-256      : sha256:${verifyRes.receipt.receiptSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["mmr:append"] = cmd_mmr_accum_159;
HANDLERS["mmr:prove"] = cmd_mmr_accum_159;
HANDLERS["mmr:verify"] = cmd_mmr_accum_159;

export async function handleMmrCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
