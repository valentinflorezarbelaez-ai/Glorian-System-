import { EosPolyglotToolchainAdapterCore } from "../../src/core/eosPolyglotToolchainAdapterCore.ts";
import { EosIssueToPrCanaryBridgeCore } from "../../src/core/eosIssueToPrCanaryBridgeCore.ts";
import { EosStaffEngineerAdversarialJudgeCore } from "../../src/core/eosStaffEngineerAdversarialJudgeCore.ts";
import { EosJarvisSdlcOrchestratorCore } from "../../src/core/eosJarvisSdlcOrchestratorCore.ts";
import { EosLiveGitDiffPrInspectorCore } from "../../src/core/eosLiveGitDiffPrInspectorCore.ts";
import { EosRepoMapSymbolCompressorCore } from "../../src/core/eosRepoMapSymbolCompressorCore.ts";
import { EosPropertyBasedShrinkingFuzzerCore } from "../../src/core/eosPropertyBasedShrinkingFuzzerCore.ts";

const HANDLERS = {};

function readFlag(args, name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function cmd_polyglot_detect(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const stackId = readFlag(args, "stack", undefined);
  const serviceName = readFlag(args, "service", "glorian-service");
  const profile = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
    stackId,
    repoPath: root,
    projectRoot: root,
    serviceName,
  });
  if (isJson) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }
  console.log(`\n[POLYGLOT] ${profile.language} (${profile.buildTool}) | test: ${profile.commands.test}`);
}

async function cmd_polyglot_normalize(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const stackId = readFlag(args, "stack", "java-maven");
  const rawOutput = readFlag(args, "log", "Tests run: 16, Failures: 0, Errors: 0 coverage: 92.5%");
  const normalized = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({ stackId, rawOutput });
  if (isJson) {
    console.log(JSON.stringify(normalized, null, 2));
    return;
  }
  console.log(
    `\n[POLYGLOT NORMALIZED] ${normalized.stackId}: ${normalized.validation.testsPassed}/${normalized.validation.totalTests} (${normalized.validation.coveragePercent}%)`,
  );
}

async function cmd_bridge_parse(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const ticketId = readFlag(args, "ticket", "PAY-881");
  const title = readFlag(args, "title", "Add idempotent checkout migration");
  const priority = readFlag(args, "priority", "Critical");
  const parsed = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
    ticketId,
    sourceSystem: readFlag(args, "source", "jira"),
    title,
    priority,
    description: "- [ ] Add idempotency key\n- [ ] Add integration test",
  });
  if (isJson) {
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }
  console.log(`\n[BRIDGE PARSE] ${parsed.ticketId} (${parsed.priority} / ${parsed.suggestedTrack})`);
}

async function cmd_bridge_diff(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const sqlMigrationSnippet = readFlag(
    args,
    "sql",
    "ALTER TABLE invoices ADD COLUMN idempotency_key TEXT; CREATE INDEX CONCURRENTLY idx_idem ON invoices(idempotency_key);",
  );
  const report = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
    changedFiles: [
      { path: "src/core/payment.ts", additions: 30 },
      { path: "test/payment.test.mjs", additions: 40 },
    ],
    sqlMigrationSnippet,
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`\n[BRIDGE DIFF] Migration=${report.migrationPattern} | Beyonce=${report.beyonceRuleSatisfied}`);
}

async function cmd_bridge_canary(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const ticketId = readFlag(args, "ticket", "PAY-881");
  const plan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId,
    featureFlagKey: `ff_${ticketId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    workflowId: "flow-canary-preview",
    approvalDiffSha256: "a".repeat(64),
  });
  if (isJson) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(`\n[CANARY PLAN] ${plan.ticketId} (${plan.stages.length} stages)`);
}

async function cmd_staff_judge(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const verdict = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
    targetId: readFlag(args, "target", "PR-237"),
    title: readFlag(args, "title", "Polyglot Staff Engineer Gate"),
  });
  if (isJson) {
    console.log(JSON.stringify(verdict, null, 2));
    return;
  }
  console.log(`\n[STAFF JUDGE] ${verdict.targetId}: ${verdict.verdict} (${verdict.overallScore}/100)`);
}

async function cmd_staff_demo(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const stack = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({ stackId: "go", serviceName: "player-api" });
  const norm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
    stackId: "go",
    rawOutput: "ok internal/domain 0.14s\nok internal/application 0.22s coverage: 93.5% of statements",
    testsPassed: 14,
    totalTests: 14,
  });
  const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId: "SPOT-235",
    ticketTitle: "End-to-end polyglot Staff demo",
    ticketDescription: "Deliver Go telemetry service with canary rollback and Staff approval.",
    companyPreset: "spotify",
  });
  const verified = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, norm.validation);
  const canary = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId: "SPOT-235",
    featureFlagKey: mission.featureFlagGuard.flagKey,
    workflowId: mission.workflowId,
    approvalDiffSha256: verified.approvalDiffSha256 ?? "0".repeat(64),
  });
  const staff = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({ targetId: "SPOT-235" });
  const payload = {
    mode: "staff-demo",
    stack,
    verifiedStatus: verified.status,
    canaryStages: canary.stages.length,
    staff,
  };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `\n[STAFF DEMO] Go=${verified.status} | Canary=${canary.stages.length} stages | Verdict=${staff.verdict}`,
  );
}

async function cmd_diff_live(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const report = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
    projectRoot: root,
    baseRef: readFlag(args, "base", "HEAD"),
    ticketId: readFlag(args, "ticket", "SPOT-LIVE"),
    writeBundle: args.includes("--write"),
  });
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    `\n[LIVE DIFF] ${report.ticketId} | files=${report.changedFiles.length} | secrets=${report.secretMatchesCount} | ready=${report.readyToShip}`,
  );
}

async function cmd_repomap_build(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const maxTokenBudget = Number(readFlag(args, "budget", "1500")) || 1500;
  const targetDir = readFlag(args, "dir", "src/core");
  const map = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
    projectRoot: root,
    targetDir,
    maxTokenBudget,
  });
  if (isJson) {
    console.log(JSON.stringify(map, null, 2));
    return;
  }
  console.log(
    `\n[REPOMAP] scanned=${map.filesScanned} included=${map.filesIncluded} tokens=${map.estimatedCompressedTokens}/${map.maxTokenBudget} savings=${map.tokenSavingsPercent}%`,
  );
}

async function cmd_pbt_check(commandContext) {
  const { args } = commandContext;
  const isJson = args.includes("--json");
  const seed = Number(readFlag(args, "seed", "1337")) || 1337;
  const suite = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(seed);
  if (isJson) {
    console.log(JSON.stringify(suite, null, 2));
    return;
  }
  console.log(`\n[PBT SHRINKER] seed=${suite.seed} passed=${suite.passedProperties}/${suite.totalProperties}`);
}

async function cmd_ship(commandContext) {
  const { args, root } = commandContext;
  const isJson = args.includes("--json");
  const ticketId = readFlag(args, "ticket", "SHIP-001");
  const liveDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({ projectRoot: root, ticketId });
  const repoMap = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
    projectRoot: root,
    targetDir: "src/core",
    maxTokenBudget: 1200,
    maxFiles: 30,
  });
  const propertySuite = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(1337);
  const staffJudge = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
    targetId: ticketId,
    title: "Master Ship Readiness Verification",
    plainSecretsDetected: liveDiff.secretMatchesCount > 0,
    unsafeMigrationDetected: liveDiff.diffAudit.migrationPattern === "UNSAFE_BREAKING_DDL",
    missingTestsForProdChanges: !liveDiff.diffAudit.beyonceRuleSatisfied,
  });
  const canaryPlan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
    ticketId,
    featureFlagKey: `ff_${ticketId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    workflowId: "flow-ship-readiness",
    approvalDiffSha256: liveDiff.inspectionDigestSha256,
  });
  const approved = liveDiff.readyToShip && propertySuite.allPassed && staffJudge.verdict === "APPROVED";
  const payload = {
    mode: "ship",
    ticketId,
    shipReadinessVerdict: approved ? "SHIP_APPROVED" : "SHIP_BLOCKED",
    liveDiff,
    repoMap,
    propertySuite,
    staffJudge,
    canaryPlan,
  };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `\n[GLORIAN SHIP] ${ticketId} -> ${payload.shipReadinessVerdict} (Staff=${staffJudge.verdict}, PBT=${propertySuite.allPassed}, Tokens=${repoMap.estimatedCompressedTokens})`,
  );
}

HANDLERS["polyglot:detect"] = cmd_polyglot_detect;
HANDLERS["polyglot:normalize"] = cmd_polyglot_normalize;
HANDLERS["bridge:parse"] = cmd_bridge_parse;
HANDLERS["bridge:diff"] = cmd_bridge_diff;
HANDLERS["bridge:canary"] = cmd_bridge_canary;
HANDLERS["staff:judge"] = cmd_staff_judge;
HANDLERS["staff:demo"] = cmd_staff_demo;
HANDLERS["diff:live"] = cmd_diff_live;
HANDLERS["repomap:build"] = cmd_repomap_build;
HANDLERS["pbt:check"] = cmd_pbt_check;
HANDLERS["ship"] = cmd_ship;

export async function handleJarvisPolyglotFrontierCommands(command, commandContext) {
  const handler = HANDLERS[command];
  if (!handler) return false;
  await handler(commandContext);
  return true;
}
