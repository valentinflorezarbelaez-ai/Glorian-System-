/**
 * @file eosJarvisSdlcOrchestratorCore.test.mjs
 * @description BDD test suite for Layer-0 Jarvis Autonomous SDLC Orchestrator & Enterprise DNA Assimilation.
 * BDD-1190..BDD-1195 / SPEC-234 / CHANGE-119
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EosJarvisSdlcOrchestratorCore } from "../src/core/eosJarvisSdlcOrchestratorCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

describe("EosJarvisSdlcOrchestratorCore (SPEC-234 / CHANGE-119)", () => {
  // BDD-1190: Spotify & Enterprise DNA Assimilation
  it("BDD-1190: should assimilate Spotify DNA profile with Backstage, Trunk-Based Development, and Honeycomb defaults", () => {
    const profile = EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({
      preset: "spotify",
      squadOwner: "music-expression-squad",
      tribe: "music-expression",
      repoPath: process.cwd(),
      projectRoot: process.cwd(),
    });

    assert.equal(profile.preset, "spotify");
    assert.equal(profile.gitStrategy, "TRUNK_BASED_DEVELOPMENT");
    assert.ok(profile.maxBranchLifetimeHours <= 48);
    assert.equal(profile.testingModel, "TESTING_HONEYCOMB");
    assert.ok(profile.minCoveragePercent >= 85);
    assert.equal(profile.backstageEnabled, true);
    assert.match(profile.dnaDigestSha256, /^[a-f0-9]{64}$/);
    assert.ok(profile.detectedRepoSignals.includes("package.json"));
    assert.ok(profile.detectedRepoSignals.includes("catalog-info.yaml"));

    // Additional presets and error validation
    const nubank = EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({ preset: "nubank" });
    assert.equal(nubank.minCoveragePercent, 90);
    assert.throws(
      () => EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({ preset: "invalid-co" }),
      /Unsupported company preset/,
    );
  });

  // BDD-1191: Ticket-to-SDLC Mission Initiation with Dark-Launch Feature Flag
  it("BDD-1191: should transform a ticket into a formal SDLC mission with EARS, BDD, and isolated worktree", () => {
    const heavyMission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-402",
      ticketTitle: "Add Backstage audio DSP telemetry microservice",
      ticketDescription:
        "Implement a new microservice architecture endpoint for audio DSP latency tracking behind a Confidence feature flag.",
      companyPreset: "spotify",
      squadOwner: "music-expression-squad",
      tribe: "music-expression",
    });

    assert.equal(heavyMission.status, "AWAITING_IMPLEMENTATION");
    assert.equal(heavyMission.track, "HEAVY_TRACK_SDD");
    assert.ok(heavyMission.earsRequirements.length >= 3);
    assert.ok(heavyMission.bddScenarios.length >= 3);
    assert.ok(heavyMission.impactedLayers.includes("Domain"));
    assert.equal(heavyMission.featureFlagGuard.defaultEnabled, false);
    assert.ok(heavyMission.worktreePath.startsWith(".worktrees/"));
    assert.match(heavyMission.receiptSha256, /^[a-f0-9]{64}$/);

    const fastMission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-403",
      ticketTitle: "Fix playlist badge tooltip alignment",
      ticketDescription: "Adjust CSS padding on small screens.",
      companyPreset: "spotify",
    });
    assert.equal(fastMission.track, "FAST_TRACK_TDD");

    assert.throws(
      () =>
        EosJarvisSdlcOrchestratorCore.initiateMission({
          ticketId: "",
          ticketTitle: "Invalid",
          ticketDescription: "Empty ticket ID",
        }),
      /ticketId must be between 1 and/,
    );
  });

  // BDD-1192: Bounded FDIR Self-Healing Loop on Test or Boundary Failures
  it("BDD-1192: should transition to HEALING on attempt 1 with structured diagnosis when gates fail", () => {
    const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-404",
      ticketTitle: "Refactor track recommendation ranking",
      ticketDescription: "Pure domain ranking engine refactor.",
      companyPreset: "spotify",
      maxHealAttempts: 3,
    });

    const healed = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, {
      testsPassed: 9,
      totalTests: 10,
      coveragePercent: 72,
      domainImportsInfrastructure: true,
      plainSecretsCount: 0,
      runtimeDependenciesCount: 0,
      lintErrorsCount: 1,
      errorLog: "Domain imported postgres client",
    });

    assert.equal(healed.status, "HEALING");
    assert.equal(healed.attempt, 1);
    assert.equal(healed.lastDiagnosis?.canRetry, true);
    assert.ok(healed.lastDiagnosis?.failureCategories.includes("BEYONCE_COVERAGE_BELOW_THRESHOLD"));
    assert.ok(healed.lastDiagnosis?.failureCategories.includes("HEXAGONAL_BOUNDARY_VIOLATION"));
    assert.ok(healed.lastDiagnosis?.failureCategories.includes("UNIT_AND_INTEGRATION_TESTS_FAILED"));
    assert.equal(healed.approvalDiffSha256, undefined);
  });

  // BDD-1193: Fail-Closed Terminal Escalation at Max Heal Attempts
  it("BDD-1193: should fail closed to FAILED when retries reach maxAttempts with open violations", () => {
    const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-405",
      ticketTitle: "Enforce secret hygiene",
      ticketDescription: "Validate fail-closed retry ceiling.",
      maxHealAttempts: 3,
    });

    const attempt1 = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, {
      testsPassed: 5,
      totalTests: 5,
      coveragePercent: 80,
      domainImportsInfrastructure: false,
      plainSecretsCount: 0,
      runtimeDependenciesCount: 0,
      lintErrorsCount: 0,
    });
    const attempt2 = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(attempt1, {
      testsPassed: 5,
      totalTests: 5,
      coveragePercent: 82,
      domainImportsInfrastructure: false,
      plainSecretsCount: 0,
      runtimeDependenciesCount: 0,
      lintErrorsCount: 0,
    });
    assert.equal(attempt2.attempt, 2);
    assert.equal(attempt2.status, "HEALING");

    const attempt3 = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(attempt2, {
      testsPassed: 5,
      totalTests: 5,
      coveragePercent: 95,
      domainImportsInfrastructure: false,
      plainSecretsCount: 1,
      runtimeDependenciesCount: 0,
      lintErrorsCount: 0,
    });

    assert.equal(attempt3.attempt, 3);
    assert.equal(attempt3.status, "FAILED");
    assert.equal(attempt3.lastDiagnosis?.canRetry, false);
    assert.ok(attempt3.lastDiagnosis?.failureCategories.includes("PLAIN_SECRET_EXPOSURE"));
    assert.equal(attempt3.approvalDiffSha256, undefined);
  });

  // BDD-1194: 100/100 Fleet Soundcheck, Backstage Catalog & Approval Diff Synthesis
  it("BDD-1194: should seal READY_FOR_APPROVAL with 100/100 Soundcheck, Backstage YAML, and approval hash", () => {
    const mission = EosJarvisSdlcOrchestratorCore.initiateMission({
      ticketId: "SPOT-406",
      ticketTitle: "Export Backstage Soundcheck telemetry",
      ticketDescription: "Full compliance verification.",
      companyPreset: "spotify",
      squadOwner: "music-expression-squad",
      tribe: "music-expression",
    });

    const approved = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(mission, {
      testsPassed: 14,
      totalTests: 14,
      coveragePercent: 93.5,
      domainImportsInfrastructure: false,
      plainSecretsCount: 0,
      runtimeDependenciesCount: 0,
      lintErrorsCount: 0,
    });

    assert.equal(approved.status, "READY_FOR_APPROVAL");
    assert.equal(approved.soundcheck?.passed, true);
    assert.equal(approved.soundcheck?.score, 100);
    assert.ok(approved.soundcheck?.backstageCatalogYaml.includes("apiVersion: backstage.io/v1alpha1"));
    assert.ok(approved.soundcheck?.backstageCatalogYaml.includes("owner: music-expression-squad"));
    assert.match(approved.approvalDiffSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(approved.executiveSummaryBullets.length, 3);
    assert.ok(approved.prMarkdownDraft.includes(`--confirm-diff=${approved.approvalDiffSha256}`));
  });

  // BDD-1195: Unified IDE Autopilot Rule Compilation & Path Confinement
  it("BDD-1195: should compile autopilot rules for all IDEs and reject path traversal outside projectRoot", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-jarvis-rules-"));
    try {
      const pkg = EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
        projectRoot: tmpDir,
        companyPreset: "spotify",
        writeToDisk: true,
      });

      assert.equal(pkg.writtenToDisk, true);
      assert.equal(pkg.canonicalRulePath, ".eos/rules/jarvis-autopilot.md");
      assert.ok(pkg.targetIdeBindings.some((b) => b.includes("Cursor")));
      assert.ok(pkg.targetIdeBindings.some((b) => b.includes("Antigravity")));
      assert.ok(pkg.targetIdeBindings.some((b) => b.includes("Claude")));
      assert.ok(pkg.targetIdeBindings.some((b) => b.includes("Kiro")));
      assert.ok(pkg.markdownContent.includes("dependencies: {}"));
      assert.ok(pkg.markdownContent.includes("--confirm-diff="));
      assert.ok(fs.existsSync(path.join(tmpDir, ".eos", "rules", "jarvis-autopilot.md")));

      assert.throws(
        () =>
          EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
            projectRoot: tmpDir,
            outputRelPath: "../escape.md",
            writeToDisk: true,
          }),
        /Path traversal rejected/,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // CLI and MCP Integration Check
  it("CLI 'jarvis:demo --json' and MCP extension actions execute cleanly", () => {
    const cliOut = execFileSync(process.execPath, [path.join(process.cwd(), "bin/eos.mjs"), "jarvis:demo", "--json"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(cliOut.trim());
    assert.equal(parsed.specId, "SPEC-234");
    assert.equal(parsed.healingTransition.status, "HEALING");
    assert.equal(parsed.finalState.status, "READY_FOR_APPROVAL");
    assert.equal(parsed.finalState.soundcheckScore, 100);

    const mcpDna = dispatchPhase7FrontierActionExt(
      "jarvis_dna_assimilate",
      { preset: "spotify" },
      { projectRoot: process.cwd() },
    );
    assert.equal(mcpDna.action, "jarvis_dna_assimilate");
    assert.equal(mcpDna.gitStrategy, "TRUNK_BASED_DEVELOPMENT");
  });
});
