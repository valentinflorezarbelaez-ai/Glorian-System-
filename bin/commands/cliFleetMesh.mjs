import { EosUniversalFleetSyncCore } from "../../src/core/eosUniversalFleetSyncCore.ts";

const HANDLERS = {};

async function cmd_fleet_sync_all(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const heal = args.includes("--heal");

  const report = EosUniversalFleetSyncCore.syncFleet(root, { heal });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN UNIVERSAL FEDERATED CROSS-FLEET SYNC (SPEC-225)`);
  console.log(`===============================================================`);
  console.log(`  Total Projects Audited : ${report.totalProjects}`);
  console.log(`  In-Sync Projects       : ${report.inSyncProjects}`);
  console.log(`  Federated Attested     : ${report.federatedAttestedProjects}`);
  console.log(`  Diverged / Dirty       : ${report.divergedProjects}`);
  console.log(`  Fleet Merkle Root      : sha256:${report.fleetMerkleRoot}`);
  console.log(`  Receipt SHA-256        : sha256:${report.receipt}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  PROJECT SYNCHRONIZATION STATUS:`);
  for (const res of report.results) {
    const statusIcon =
      res.syncState === "IN_SYNC" ? "[IN_SYNC]" : res.syncState === "FEDERATED_ATTESTED" ? "[ATTESTED]" : "[DIVERGED]";
    console.log(`   - ${res.id.padEnd(32)}: ${statusIcon.padEnd(12)} (HEAD: ${res.headCommitSha.slice(0, 7)})`);
    console.log(`     ${res.details}`);
  }
  console.log(`===============================================================\n`);
}

async function cmd_fleet_audit_all(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");

  const report = EosUniversalFleetSyncCore.auditFleetHealth(root);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN UNIVERSAL FLEET SOUNDCHECK SCORECARD (SPEC-225)`);
  console.log(`===============================================================`);
  console.log(`  Total Repositories     : ${report.totalProjects}`);
  console.log(`  Fleet Average Score    : ${report.fleetAverageScore} / 100`);
  console.log(`  Deploy Quorum Status   : ${report.deploymentAuthorizedQuorum ? "AUTHORIZED (>= 70)" : "GATED"}`);
  console.log(
    `  Grade Distribution     : A+: ${report.gradeCounts["A+"]}, A: ${report.gradeCounts.A}, B: ${report.gradeCounts.B}, C: ${report.gradeCounts.C}, F: ${report.gradeCounts.F}`,
  );
  console.log(`  Fleet Merkle Root      : sha256:${report.fleetMerkleRoot}`);
  console.log(`  Receipt SHA-256        : sha256:${report.receipt}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  INDIVIDUAL REPOSITORY SOUNDCHECKS:`);
  for (const rep of report.reports) {
    console.log(
      `   - ${rep.id.padEnd(32)}: ${rep.totalScore.toString().padStart(3)}/100 [Grade ${rep.grade}] - Deployable: ${rep.eligibleForAutonomousDeploy ? "YES" : "NO"}`,
    );
    console.log(
      `     Git: ${rep.gitHealthScore}/25 | Arch: ${rep.architectureScore}/25 | Sec: ${rep.securityScore}/25 | Ops: ${rep.productionAvailabilityScore}/25`,
    );
  }
  console.log(`===============================================================\n`);
}

async function cmd_fleet_heal_all(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");

  const report = EosUniversalFleetSyncCore.healAll(root);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN AUTONOMOUS FLEET DRIFT HEALER (SPEC-225)`);
  console.log(`===============================================================`);
  console.log(`  Total Evaluated        : ${report.totalEvaluated}`);
  console.log(`  Total Healed           : ${report.totalHealed}`);
  console.log(`  Receipt SHA-256        : sha256:${report.receipt}`);
  console.log(`---------------------------------------------------------------`);
  for (const h of report.results) {
    console.log(`   - ${h.projectId.padEnd(32)}: [${h.status}] ${h.details}`);
  }
  console.log(`===============================================================\n`);
}

HANDLERS["fleet:sync-all"] = cmd_fleet_sync_all;
HANDLERS["fleet:audit-all"] = cmd_fleet_audit_all;
HANDLERS["fleet:heal-all"] = cmd_fleet_heal_all;

export async function handleFleetMeshCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
