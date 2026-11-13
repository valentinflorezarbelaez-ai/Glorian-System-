import { EosVerifiableSecretSharingCore } from "../../src/core/eosVerifiableSecretSharingCore.ts";

const HANDLERS = {};

async function cmd_vss_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const secretMsg = "Sovereign-Key-2027";
  const k = 3;
  const n = 5;

  // 1. Feldman VSS Split
  const deal = EosVerifiableSecretSharingCore.splitSecret(secretMsg, k, n, "feldman");

  // 2. Verify all shares
  const verifications = deal.shares.map((sh) => EosVerifiableSecretSharingCore.verifyShare(sh, deal.commitments));
  const allVerified = verifications.every((v) => v.valid);

  // 3. Reconstruct using subset of shares {1, 3, 5}
  const subset = [deal.shares[0], deal.shares[2], deal.shares[4]];
  const reconstruction = EosVerifiableSecretSharingCore.reconstruct(subset, k, deal.commitments);

  // 4. Test invalid-share detection with a deliberately altered demo share
  const tamperedShare = {
    id: 2,
    valueHex: (BigInt("0x" + deal.shares[1].valueHex) + 1n).toString(16),
  };
  const tamperedCheck = EosVerifiableSecretSharingCore.verifyShare(tamperedShare, deal.commitments);

  // Reconstruct with tampered share in pool (shares 1, 2-tampered, 3, 4)
  const pool = [deal.shares[0], tamperedShare, deal.shares[2], deal.shares[3]];
  const cheaterReconstruction = EosVerifiableSecretSharingCore.reconstruct(pool, k, deal.commitments);

  // 5. Test Pedersen VSS
  const pedersenDeal = EosVerifiableSecretSharingCore.splitSecret(secretMsg, k, n, "pedersen");
  const pedersenVerifications = pedersenDeal.shares.map((sh) =>
    EosVerifiableSecretSharingCore.verifyShare(sh, pedersenDeal.commitments),
  );
  const pedersenAllValid = pedersenVerifications.every((v) => v.valid);

  const report = {
    mode: "demo",
    securityStatus: "experimental-not-for-production-secrets",
    feldman: {
      secretMessage: secretMsg,
      threshold: k,
      totalShares: n,
      commitmentsCount: deal.commitments.commitmentsHex.length,
      allSharesVerified: allVerified,
      reconstructedSecret: reconstruction.secretString,
      reconstructionMatches: reconstruction.secretString === secretMsg,
      cheaterDetected: !tamperedCheck.valid,
      cheatersIsolated: cheaterReconstruction.cheatersIdentified,
      recoveredAfterCheaterIsolation: cheaterReconstruction.secretString === secretMsg,
    },
    pedersen: {
      allSharesVerified: pedersenAllValid,
      commitmentsCount: pedersenDeal.commitments.commitmentsHex.length,
    },
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN VERIFIABLE SECRET SHARING (VSS) DEMO (SPEC-233)`);
  console.log(`===============================================================`);
  console.log(`  Original Secret        : "${secretMsg}"`);
  console.log(`  Threshold Parameters   : (${k}, ${n})`);
  console.log(`  Feldman Commitments    : ${deal.commitments.commitmentsHex.length} homomorphic points`);
  console.log(`  All Shares Authentic  : ${allVerified} (100% verified against C_j)`);
  console.log(`  Subset Reconstruction  : "${reconstruction.secretString}" (shares {1, 3, 5})`);
  console.log(`  Invalid Demo Share     : Participant #2 rejected: ${!tamperedCheck.valid}`);
  console.log(`  Invalid Share IDs      : [${cheaterReconstruction.cheatersIdentified.join(", ")}]`);
  console.log(`  Auto-Recovered Secret  : "${cheaterReconstruction.secretString}"`);
  console.log(`  Pedersen Demo Check    : ${pedersenAllValid ? "PASSED (not a security audit)" : "FAILED"}`);
  console.log(`===============================================================\n`);
}

async function cmd_vss_split(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const keyArg = args.find((a) => !a.startsWith("--") && a !== "vss:split");
  if (keyArg) {
    throw new Error(
      "Do not pass secrets as command-line arguments. vss:split is a demo; use a protected input channel for real secrets.",
    );
  }
  const secret = "Glorian-VSS-Demo-Only";
  const scheme = args.includes("--feldman") ? "feldman" : "pedersen";
  const deal = EosVerifiableSecretSharingCore.splitSecret(secret, 3, 5, scheme);

  const report = {
    mode: "demo",
    securityStatus: "experimental-not-for-production-secrets",
    scheme: deal.scheme,
    k: deal.k,
    n: deal.n,
    commitmentsCount: deal.commitments.commitmentsHex.length,
    sharesCount: deal.shares.length,
    shares: deal.shares.map((s) => ({
      id: s.id,
      valueHex: s.valueHex.slice(0, 16) + "...",
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN VSS SECRET SPLIT (SPEC-233)`);
  console.log(`===============================================================`);
  console.log(`  Scheme                 : ${deal.scheme.toUpperCase()}`);
  console.log(`  Threshold (k, n)       : (3, 5)`);
  console.log(`  Commitments Published  : ${deal.commitments.commitmentsHex.length}`);
  console.log(`  Shares Distributed     : ${deal.shares.length} participants`);
  console.log(`===============================================================\n`);
}

async function cmd_vss_verify(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");

  const deal = EosVerifiableSecretSharingCore.splitSecret("Audit-Token-001", 3, 5);
  const share1 = deal.shares[0];
  const res = EosVerifiableSecretSharingCore.verifyShare(share1, deal.commitments);

  const report = {
    participantId: share1.id,
    valid: res.valid,
    scheme: deal.scheme,
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN VSS SHARE VERIFICATION (SPEC-233)`);
  console.log(`===============================================================`);
  console.log(`  Participant ID         : ${share1.id}`);
  console.log(`  Homomorphic Check      : ${res.valid ? "PASSED (Authentic Share)" : "FAILED"}`);
  console.log(`===============================================================\n`);
}

HANDLERS["vss:demo"] = cmd_vss_demo;
HANDLERS["vss:split"] = cmd_vss_split;
HANDLERS["vss:verify"] = cmd_vss_verify;

export async function handleVssCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
