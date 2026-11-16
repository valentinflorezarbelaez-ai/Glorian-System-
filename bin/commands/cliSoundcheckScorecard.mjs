/**
 * CLI Spotify Backstage Soundcheck Real-Time Fleet Scorecard Handlers
 *
 * Implements toolchain:soundcheck:* subcommands for 5-pillar grading,
 * maturity certification tiers, DORA velocity tracking, and audit receipts.
 *
 * Conforms to SPEC-299 / CHANGE-161.
 */

import { BackstageSoundcheckEngine } from "../../src/core/eosBackstageSoundcheckScorecard.ts";

const HANDLERS = {};
const globalEngine = new BackstageSoundcheckEngine();

async function cmd_soundcheck_score(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const projectArg =
    args.find((a) => a.startsWith("--project="))?.split("=")[1] ||
    args.find((a) => !a.startsWith("-") && a !== commandContext.command && !a.startsWith("toolchain:")) ||
    "eos-system";

  const card = globalEngine.scoreRepository(projectArg);

  if (isJson) {
    console.log(JSON.stringify(card, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🎵  SPOTIFY BACKSTAGE SOUNDCHECK SCORECARD (SPEC-299)         ");
  console.log("===============================================================");
  console.log(`  Project Identifier  : ${card.projectId}`);
  console.log(`  Overall Health Score: ${card.overallScore}%`);
  console.log(`  Certification Tier  : ${card.certificationTier}`);
  console.log(`  DORA Velocity Tier  : ${card.dora.tier} (${card.dora.deploymentFrequency})`);
  console.log(`  Drift Detected      : ${card.driftDetected}`);
  console.log("---------------------------------------------------------------");
  console.log("  PILLAR BREAKDOWN:");
  for (const p of Object.values(card.pillars)) {
    console.log(`    - ${p.name.padEnd(38)} : ${String(p.score).padStart(3)}% [${p.status}]`);
  }
  if (card.remediationPlan.length > 0) {
    console.log("---------------------------------------------------------------");
    console.log("  REMEDIATION PLAN:");
    for (const r of card.remediationPlan) {
      console.log(`    ! ${r}`);
    }
  }
  console.log("===============================================================\n");
}

async function cmd_soundcheck_matrix(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const matrix = globalEngine.generateFleetMatrix();

  if (isJson) {
    console.log(JSON.stringify(matrix, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🌐  SPOTIFY BACKSTAGE FLEET SOUNDCHECK MATRIX (SPEC-299)      ");
  console.log("===============================================================");
  console.log(`  Total Repositories  : ${matrix.totalRepositoriesScored}`);
  console.log(`  Average Fleet Score : ${matrix.averageFleetScore}%`);
  console.log(
    `  Tier Distribution   : Platinum=${matrix.tierDistribution.LEVEL_4_PLATINUM}, Gold=${matrix.tierDistribution.LEVEL_3_GOLD}, Silver=${matrix.tierDistribution.LEVEL_2_SILVER}, Bronze=${matrix.tierDistribution.LEVEL_1_BRONZE}`,
  );
  console.log("---------------------------------------------------------------");
  console.log("  FLEET LEADERBOARD:");
  for (const card of matrix.scorecards) {
    console.log(
      `    - ${card.projectId.padEnd(32)} : ${String(card.overallScore).padStart(5)}% | ${card.certificationTier} | DORA: ${card.dora.tier}`,
    );
  }
  console.log("===============================================================\n");
}

async function cmd_soundcheck_drift(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const projectArg = args.find((a) => a.startsWith("--project="))?.split("=")[1];

  const matrix = globalEngine.generateFleetMatrix();
  const drifting = matrix.scorecards.filter((c) => (projectArg ? c.projectId === projectArg : c.driftDetected));

  if (isJson) {
    console.log(JSON.stringify(drifting, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚠️  SOUNDCHECK ARCHITECTURAL DRIFT DETECTOR (SPEC-299)         ");
  console.log("===============================================================");
  if (drifting.length === 0) {
    console.log("  ✅ Zero architectural drift detected across the fleet!");
  } else {
    for (const d of drifting) {
      console.log(`  Project: ${d.projectId} (Overall: ${d.overallScore}%)`);
      for (const r of d.remediationPlan) {
        console.log(`    ↳ ${r}`);
      }
    }
  }
  console.log("===============================================================\n");
}

async function cmd_soundcheck_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await globalEngine.auditFleetSoundcheckPipeline();

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  BACKSTAGE SOUNDCHECK AUDIT RECEIPT (SPEC-299)             ");
  console.log("===============================================================");
  console.log(`  Specification Ref   : ${receipt.specRef}`);
  console.log(`  Repositories Scored : ${receipt.totalRepositoriesScored}`);
  console.log(`  Average Fleet Score : ${receipt.averageFleetScore}%`);
  console.log(`  Platinum Tiers      : ${receipt.platinumTiersCount}`);
  console.log(`  Gold Tiers          : ${receipt.goldTiersCount}`);
  console.log(`  Silver Tiers        : ${receipt.silverTiersCount}`);
  console.log(`  Bronze Tiers        : ${receipt.bronzeTiersCount}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:soundcheck:score"] = cmd_soundcheck_score;
HANDLERS["toolchain:soundcheck:matrix"] = cmd_soundcheck_matrix;
HANDLERS["toolchain:soundcheck:drift"] = cmd_soundcheck_drift;
HANDLERS["toolchain:soundcheck:audit"] = cmd_soundcheck_audit;

export async function handleSoundcheckCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
