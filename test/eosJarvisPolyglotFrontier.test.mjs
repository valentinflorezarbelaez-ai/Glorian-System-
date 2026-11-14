import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EosPolyglotToolchainAdapterCore } from "../src/core/eosPolyglotToolchainAdapterCore.ts";
import { EosIssueToPrCanaryBridgeCore } from "../src/core/eosIssueToPrCanaryBridgeCore.ts";
import { EosStaffEngineerAdversarialJudgeCore } from "../src/core/eosStaffEngineerAdversarialJudgeCore.ts";
import { EosJarvisSdlcOrchestratorCore } from "../src/core/eosJarvisSdlcOrchestratorCore.ts";
import { dispatchPhase7FrontierActionExt2 } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts";

const ROOT = process.cwd();

test("SPEC-235..SPEC-237 / CHANGE-120 — Polyglot Adapter, Issue/Canary Bridge & Staff Judge", async (t) => {
  await t.test("BDD-1196: builds Java Maven & Go command matrices and Golden Path layouts", () => {
    const javaProfile = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
      stackId: "java-maven",
      serviceName: "playback-telemetry",
    });
    assert.equal(javaProfile.language, "Java 21 LTS");
    assert.equal(javaProfile.buildTool, "Maven");
    assert.match(javaProfile.commands.test, /mvn/);
    assert.equal(javaProfile.hexagonalDirectories.domain, "src/main/java/domain");
    assert.match(javaProfile.profileDigestSha256, /^[0-9a-f]{64}$/);

    const goProfile = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
      stackId: "go",
      serviceName: "EdgeRouter",
    });
    assert.equal(goProfile.language, "Go");
    assert.match(goProfile.commands.coverage, /go test -race -coverprofile/);
    assert.equal(goProfile.hexagonalDirectories.application, "internal/application");
  });

  await t.test("BDD-1197: inspects confined repoPath manifests and blocks traversal", () => {
    const tmpRel = path.join(".eos", "tmp-polyglot-go-probe");
    const tmpAbs = path.join(ROOT, tmpRel);
    fs.mkdirSync(tmpAbs, { recursive: true });
    try {
      fs.writeFileSync(path.join(tmpAbs, "go.mod"), "module spotify.internal/player\n\ngo 1.24\n", "utf8");
      const detected = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
        projectRoot: ROOT,
        repoPath: tmpRel,
      });
      assert.equal(detected.stackId, "go");
      assert.ok(detected.detectedManifests.includes("go.mod"));
    } finally {
      fs.rmSync(tmpAbs, { recursive: true, force: true });
    }

    assert.throws(
      () =>
        EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
          projectRoot: ROOT,
          repoPath: "../outside-workspace",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1198: normalizes raw Maven Surefire & Go coverage logs", () => {
    const mvnNorm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: "java-maven",
      rawOutput: "Tests run: 24, Failures: 1, Errors: 0, Skipped: 0",
    });
    assert.equal(mvnNorm.parsedFromRawOutput, true);
    assert.equal(mvnNorm.validation.totalTests, 24);
    assert.equal(mvnNorm.validation.testsPassed, 23);

    const goNorm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: "go",
      rawOutput: "ok  spotify.internal/player  0.120s  coverage: 91.4% of statements",
    });
    assert.equal(goNorm.parsedFromRawOutput, true);
    assert.equal(goNorm.validation.coveragePercent, 91.4);
    assert.equal(goNorm.validation.testsPassed, 1);
  });

  await t.test("BDD-1199: parses pytest and cargo logs into canonical validation input", () => {
    const pyNorm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: "python",
      rawOutput: "================== 18 passed, 2 failed in 0.42s ==================",
    });
    assert.equal(pyNorm.parsedFromRawOutput, true);
    assert.equal(pyNorm.validation.testsPassed, 18);
    assert.equal(pyNorm.validation.totalTests, 20);

    const rustNorm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: "rust",
      rawOutput: "test result: ok. 15 passed; 0 failed; 0 ignored; 0 measured",
    });
    assert.equal(rustNorm.parsedFromRawOutput, true);
    assert.equal(rustNorm.validation.testsPassed, 15);
    assert.equal(rustNorm.validation.totalTests, 15);
  });

  await t.test("BDD-1200: feeds normalized polyglot validation into verifyAndHealMission", () => {
    const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-235",
      ticketTitle: "Deploy Go playback telemetry endpoint",
      ticketDescription: "Deliver pure domain logic in Go behind feature flag.",
      companyPreset: "spotify",
    });
    const norm = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: "go",
      rawOutput: "ok spotify/telemetry 0.10s coverage: 94.0% of statements",
      testsPassed: 14,
      totalTests: 14,
    });
    const verified = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, norm.validation);
    assert.equal(verified.status, "READY_FOR_APPROVAL");
    assert.equal(verified.soundcheck?.score, 100);
  });

  await t.test("BDD-1201: normalizes Jira/GitHub issue checklists and SLA track", () => {
    const issue = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
      key: "PAY-881",
      sourceSystem: "jira",
      summary: "Enforce payment webhook idempotency",
      priority: "Critical",
      description: "## Scope\n- [ ] Validate idempotency key header\n- [ ] Emit latency P99 histograms",
      components: ["checkout-api"],
      labels: ["payments"],
    });
    assert.equal(issue.ticketId, "PAY-881");
    assert.equal(issue.priority, "P1");
    assert.equal(issue.slaHours, 24);
    assert.equal(issue.suggestedTrack, "HEAVY_TRACK_SDD");
    assert.deepEqual(issue.acceptanceCriteria, ["Validate idempotency key header", "Emit latency P99 histograms"]);
    assert.match(issue.issueDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1202: enforces Beyonce Rule on diff with and without tests", () => {
    const unsafeDiff = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles: [{ path: "src/core/billingEngine.ts", additions: 45, deletions: 10 }],
    });
    assert.equal(unsafeDiff.beyonceRuleSatisfied, false);
    assert.ok(unsafeDiff.blockingRisks.some((r) => r.includes("Beyonce Rule")));

    const safeDiff = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles: [
        { path: "src/core/billingEngine.ts", additions: 45 },
        { path: "test/billingEngine.test.mjs", additions: 60 },
      ],
    });
    assert.equal(safeDiff.beyonceRuleSatisfied, true);
    assert.equal(safeDiff.blockingRisks.length, 0);
  });

  await t.test("BDD-1203: approves additive Expand-and-Contract SQL migrations", () => {
    const audit = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles: [{ path: "migrations/004_add_idem.sql" }],
      sqlMigrationSnippet:
        "ALTER TABLE invoices ADD COLUMN idempotency_key TEXT; CREATE INDEX CONCURRENTLY idx_inv_idem ON invoices(idempotency_key);",
    });
    assert.equal(audit.migrationPattern, "SAFE_EXPAND_AND_CONTRACT");
    assert.equal(audit.unsafeDdlStatements.length, 0);
  });

  await t.test("BDD-1204: rejects breaking DDL (DROP COLUMN / NOT NULL without DEFAULT)", () => {
    const audit = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles: [{ path: "migrations/005_drop_col.sql" }],
      sqlMigrationSnippet:
        "ALTER TABLE users DROP COLUMN legacy_pin; ALTER TABLE orders ADD COLUMN region TEXT NOT NULL;",
    });
    assert.equal(audit.migrationPattern, "UNSAFE_BREAKING_DDL");
    assert.equal(audit.unsafeDdlStatements.length, 2);
    assert.ok(audit.blockingRisks.length > 0);
  });

  await t.test("BDD-1205: compiles 4-stage Canary schedule and kill-switch commands", () => {
    const plan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
      ticketId: "PAY-881",
      featureFlagKey: "ff_pay_881_idempotency",
      workflowId: "flow-pay-881",
      approvalDiffSha256: "b".repeat(64),
    });
    assert.deepEqual(
      plan.stages.map((s) => s.trafficPercent),
      [1, 10, 50, 100],
    );
    assert.match(plan.killSwitchCommands.disableFeatureFlagCmd, /ff_pay_881_idempotency/);
    assert.match(plan.blamelessPostmortemTemplate, /Blameless Postmortem/);
    assert.match(plan.planDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1206: approves clean Staff dual-judge proposal with >= 85 scores", () => {
    const report = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-500",
      title: "Add backpressure & idempotency",
      pillarScores: {
        idempotencyAndRetries: 95,
        resilienceAndBackpressure: 92,
        dataAndMigrationSafety: 96,
        observabilityAndSlo: 90,
        securityAndPrivacy: 98,
        testingHoneycombAndBeyonceRule: 94,
      },
    });
    assert.equal(report.verdict, "APPROVED");
    assert.equal(report.judgeAlpha.passed, true);
    assert.equal(report.judgeBeta.passed, true);
    assert.equal(report.blockingFindings.length, 0);
    assert.match(report.attestationDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1207: returns CHANGES_REQUIRED for 70-84 observability pillar score", () => {
    const report = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-501",
      pillarScores: { observabilityAndSlo: 78 },
    });
    assert.equal(report.verdict, "CHANGES_REQUIRED");
    assert.ok(report.requiredRemediations.some((r) => r.includes("OpenTelemetry")));
  });

  await t.test("BDD-1208: blocks PR when plainSecretsDetected or unsafeMigrationDetected", () => {
    const secretBlock = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-502",
      plainSecretsDetected: true,
    });
    assert.equal(secretBlock.verdict, "BLOCKED");
    assert.equal(secretBlock.judgeBeta.passed, false);

    const ddlBlock = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-503",
      unsafeMigrationDetected: true,
    });
    assert.equal(ddlBlock.verdict, "BLOCKED");
    assert.equal(ddlBlock.judgeAlpha.passed, false);
  });

  await t.test("BDD-1209: blocks PR on missing tests (Beyonce Rule) or SPOF", () => {
    const missingTestsBlock = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-504",
      missingTestsForProdChanges: true,
    });
    assert.equal(missingTestsBlock.verdict, "BLOCKED");
    assert.equal(missingTestsBlock.judgeBeta.passed, false);

    const spofBlock = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-505",
      singlePointOfFailureDetected: true,
    });
    assert.equal(spofBlock.verdict, "BLOCKED");
    assert.equal(spofBlock.judgeAlpha.passed, false);
  });

  await t.test("BDD-1210: clamps scores to [0, 100] and verifies deterministic digests, CLI & MCP", () => {
    const r1 = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-506",
      pillarScores: { securityAndPrivacy: 140, idempotencyAndRetries: -20 },
    });
    const r2 = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: "PR-506",
      pillarScores: { securityAndPrivacy: 140, idempotencyAndRetries: -20 },
    });
    assert.equal(r1.pillarScores.securityAndPrivacy, 100);
    assert.equal(r1.pillarScores.idempotencyAndRetries, 0);
    assert.equal(r1.attestationDigestSha256, r2.attestationDigestSha256);

    const demoOut = execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "staff:demo", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const parsedDemo = JSON.parse(demoOut);
    assert.equal(parsedDemo.mode, "staff-demo");
    assert.equal(parsedDemo.verifiedStatus, "READY_FOR_APPROVAL");
    assert.equal(parsedDemo.staff.verdict, "APPROVED");

    const mcpDeps = { projectRoot: ROOT, mcpCalls: 0, auditEntries: [] };
    const mcpJudge = dispatchPhase7FrontierActionExt2("staff_adversarial_judge", { targetId: "MCP-237" }, mcpDeps);
    assert.equal(mcpJudge.action, "staff_adversarial_judge");
    assert.equal(mcpJudge.verdict, "APPROVED");
  });
});
