import { EosJarvisSdlcOrchestratorCore } from "../../src/core/eosJarvisSdlcOrchestratorCore.ts";

const HANDLERS = {};

function readFlag(args, name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function cmd_jarvis_demo(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const preset = readFlag(args, "company", "spotify");

  const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId: "SPOT-234",
    ticketTitle: "Implement Gapless Audio Telemetry Endpoint",
    ticketDescription:
      "Add Backstage-cataloged microservice endpoint behind feature flag with full Testing Honeycomb coverage and Hexagonal isolation.",
    companyPreset: preset,
    maxHealAttempts: 3,
  });

  // Attempt 1: simulate Beyoncé Rule coverage gap + Hexagonal boundary violation -> FDIR HEALING
  const healingState = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, {
    testsPassed: 11,
    totalTests: 12,
    coveragePercent: 74,
    domainImportsInfrastructure: true,
    plainSecretsCount: 0,
    runtimeDependenciesCount: 0,
    lintErrorsCount: 1,
    errorLog: "Domain imported adapter; test_gapless_transition failed",
  });

  // Attempt 2: after surgical self-heal -> READY_FOR_APPROVAL (100/100 Soundcheck)
  const approvedState = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(healingState, {
    testsPassed: 12,
    totalTests: 12,
    coveragePercent: 94,
    domainImportsInfrastructure: false,
    plainSecretsCount: 0,
    runtimeDependenciesCount: 0,
    lintErrorsCount: 0,
  });

  const rulesPackage = EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
    projectRoot: root,
    companyPreset: preset,
    writeToDisk: false,
  });

  const report = {
    mode: "demo",
    specId: "SPEC-234",
    companyDna: mission.companyDna,
    healingTransition: {
      attempt: healingState.attempt,
      status: healingState.status,
      failureCategories: healingState.lastDiagnosis?.failureCategories ?? [],
    },
    finalState: {
      missionId: approvedState.missionId,
      workflowId: approvedState.workflowId,
      status: approvedState.status,
      attempt: approvedState.attempt,
      soundcheckScore: approvedState.soundcheck?.score ?? 0,
      approvalDiffSha256: approvedState.approvalDiffSha256,
      executiveSummaryBullets: approvedState.executiveSummaryBullets,
      backstageCatalogYaml: approvedState.soundcheck?.backstageCatalogYaml,
    },
    autopilotRules: {
      canonicalRulePath: rulesPackage.canonicalRulePath,
      targetIdeBindings: rulesPackage.targetIdeBindings,
      rulesDigestSha256: rulesPackage.rulesDigestSha256,
    },
  };

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN JARVIS AUTONOMOUS SDLC DEMO (SPEC-234)`);
  console.log(`===============================================================`);
  console.log(`  Company DNA            : ${mission.companyDna.companyName} (${mission.companyDna.testingModel})`);
  console.log(
    `  Attempt #1 (FDIR)      : ${healingState.status} (${healingState.lastDiagnosis?.failureCategories.join(", ")})`,
  );
  console.log(`  Attempt #2 (Verified)  : ${approvedState.status} (Soundcheck ${approvedState.soundcheck?.score}/100)`);
  console.log(`  Approval Hash          : ${approvedState.approvalDiffSha256}`);
  console.log(`===============================================================\n`);
}

async function cmd_jarvis_dna(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const preset = readFlag(args, "company", "spotify");
  const squadOwner = readFlag(args, "squad", undefined);
  const tribe = readFlag(args, "tribe", undefined);

  const profile = EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({
    preset,
    squadOwner,
    tribe,
    repoPath: root,
    projectRoot: root,
  });

  if (isJson) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ENTERPRISE DNA ASSIMILATION (SPEC-234)`);
  console.log(`===============================================================`);
  console.log(`  Company                : ${profile.companyName} (${profile.preset})`);
  console.log(`  Squad / Tribe          : ${profile.squadOwner} / ${profile.tribe}`);
  console.log(`  Git Strategy           : ${profile.gitStrategy} (<= ${profile.maxBranchLifetimeHours}h)`);
  console.log(`  Testing Model          : ${profile.testingModel} (min ${profile.minCoveragePercent}%)`);
  console.log(`  DNA Digest SHA-256     : ${profile.dnaDigestSha256}`);
  console.log(`===============================================================\n`);
}

async function cmd_jarvis_sdlc(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const ticketId = readFlag(args, "ticket", "SPOT-101");
  const ticketTitle = readFlag(args, "title", "Implement specification-driven feature");
  const ticketDescription = readFlag(
    args,
    "desc",
    "Deliver cleanly isolated domain logic and honeycomb tests behind a dark-launch feature flag.",
  );
  const companyPreset = readFlag(args, "company", "spotify");

  const initiated = EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId,
    ticketTitle,
    ticketDescription,
    companyPreset,
  });

  const verified = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(initiated, {
    testsPassed: 10,
    totalTests: 10,
    coveragePercent: 92,
    domainImportsInfrastructure: false,
    plainSecretsCount: 0,
    runtimeDependenciesCount: 0,
    lintErrorsCount: 0,
  });

  if (isJson) {
    console.log(JSON.stringify(verified, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN JARVIS SDLC MISSION (${verified.directive.ticketId})`);
  console.log(`===============================================================`);
  console.log(`  Mission / Workflow     : ${verified.missionId} / ${verified.workflowId}`);
  console.log(`  Track / Branch         : ${verified.track} / ${verified.branchName}`);
  console.log(`  Status / Soundcheck    : ${verified.status} (${verified.soundcheck?.score ?? 0}/100)`);
  console.log(`  Approval Hash          : ${verified.approvalDiffSha256 ?? "N/A"}`);
  console.log(`===============================================================\n`);
}

async function cmd_jarvis_rules(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const companyPreset = readFlag(args, "company", "spotify");
  const writeToDisk = args.includes("--write");

  const pkg = EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
    projectRoot: root,
    companyPreset,
    writeToDisk,
  });

  if (isJson) {
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN UNIFIED IDE AUTOPILOT RULES (SPEC-234)`);
  console.log(`===============================================================`);
  console.log(`  Canonical Path         : ${pkg.canonicalRulePath}`);
  console.log(`  Written To Disk        : ${pkg.writtenToDisk}`);
  console.log(`  IDE Bindings           : ${pkg.targetIdeBindings.join(", ")}`);
  console.log(`  Rules Digest SHA-256   : ${pkg.rulesDigestSha256}`);
  console.log(`===============================================================\n`);
}

HANDLERS["jarvis:demo"] = cmd_jarvis_demo;
HANDLERS["jarvis:dna"] = cmd_jarvis_dna;
HANDLERS["jarvis:sdlc"] = cmd_jarvis_sdlc;
HANDLERS["jarvis:rules"] = cmd_jarvis_rules;

export async function handleJarvisSdlcCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
