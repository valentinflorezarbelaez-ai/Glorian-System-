/**
 * ============================================================================
 * EOS SYSTEM — SPOTIFY INSTITUTIONAL CODEX TEST SUITE (Layer 0)
 * ============================================================================
 * Governed by SPEC-024 & BDD-054 (engineering.atspotify.com standard).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSpotifyArchitectureHealth,
  verifyBackstageGoldenPath,
  evaluateCanaryStage,
  planFleetshiftMigration,
} from "../src/core/eosSpotifyInstitutionalCodex.ts";

describe("EOS Spotify Institutional Engineering Codex Suite (SPEC-024, BDD-054)", () => {
  describe("Suite 1: Spotify Architecture Health Evaluator (6 Pillars)", () => {
    it("evaluates a compliant service achieving SOUNDCHECK_APEX score (100/100)", () => {
      const evaluation = evaluateSpotifyArchitectureHealth({
        usesGoldenPath: true,
        hasCatalogInfoYaml: true,
        hasTechDocsAndRunbook: true,
        compliesWithBS1770Loudness: true,
        hasProgressiveCanaryPipeline: true,
        hasAutomatedKillSwitch: true,
        hasBlamelessPostmortemProcess: true,
        unitTestCoveragePercent: 95,
      });

      assert.equal(evaluation.institutionalScore, 100);
      assert.equal(evaluation.soundcheckTier, "SOUNDCHECK_APEX");
      assert.equal(evaluation.findings.length, 0);
      assert.equal(evaluation.pillarScores.goldenPaths, 20);
      assert.equal(evaluation.pillarScores.alignedAutonomy, 15);
      assert.equal(evaluation.pillarScores.eventDelivery, 15);
      assert.equal(evaluation.pillarScores.audioDspStandard, 20);
      assert.equal(evaluation.pillarScores.canaryDelivery, 15);
      assert.equal(evaluation.pillarScores.fleetshiftSre, 15);
    });

    it("penalizes off-golden-path services and unconstrained audio", () => {
      const evaluation = evaluateSpotifyArchitectureHealth({
        usesGoldenPath: false,
        hasCatalogInfoYaml: false,
        hasTechDocsAndRunbook: false,
        compliesWithBS1770Loudness: false,
        hasProgressiveCanaryPipeline: false,
        hasAutomatedKillSwitch: false,
        hasBlamelessPostmortemProcess: false,
        unitTestCoveragePercent: 50,
      });

      assert.ok(evaluation.institutionalScore < 40);
      assert.equal(evaluation.soundcheckTier, "RUMOUR_DRIVEN_RISK");
      assert.ok(evaluation.findings.some((f) => f.includes("OFF_GOLDEN_PATH")));
      assert.ok(evaluation.findings.some((f) => f.includes("MISSING_CATALOG_INFO")));
      assert.ok(evaluation.findings.some((f) => f.includes("NON_COMPLIANT_AUDIO")));
      assert.ok(evaluation.recommendations.length > 0);
    });
  });

  describe("Suite 2: Backstage Golden Path & Soundcheck Validator", () => {
    it("certifies compliant repository with valid catalog-info.yaml", () => {
      const report = verifyBackstageGoldenPath({
        serviceName: "playback-session-service",
        filesPresent: ["catalog-info.yaml", "README.md", "src/main.go"],
        catalogInfoContent: `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: playback-session-service
  description: Handles active playback sessions
spec:
  type: service
  lifecycle: production
  owner: squad-playback-experience`,
      });

      assert.equal(report.isCompliant, true);
      assert.equal(report.soundcheckScore, 100);
      assert.equal(report.missingArtifacts.length, 0);
      assert.equal(report.catalogInfo?.owner, "squad-playback-experience");
      assert.equal(report.catalogInfo?.lifecycle, "production");
      assert.equal(report.sha256Receipt.length, 64);
    });

    it("flags missing catalog-info.yaml and lowers soundcheck score", () => {
      const report = verifyBackstageGoldenPath({
        serviceName: "unregistered-tool",
        filesPresent: ["README.md"],
      });

      assert.equal(report.isCompliant, false);
      assert.ok(report.soundcheckScore < 100);
      assert.ok(report.missingArtifacts.includes("catalog-info.yaml"));
    });
  });

  describe("Suite 3: Progressive Canary Gate & Automated Kill-Switch", () => {
    it("approves stage advance when error rate and latency are nominal", () => {
      const decision = evaluateCanaryStage({
        stage: "5%",
        trafficPercentage: 5,
        totalRequests: 50000,
        errorCount: 8, // 0.016% error rate (< 0.10%)
        p99LatencyMs: 32,
        maxAllowedP99Ms: 50,
        observationWindowMinutes: 30,
      });

      assert.equal(decision.decision, "ADVANCE_STAGE");
      assert.equal(decision.killSwitchEngaged, false);
      assert.equal(decision.nextStage, "25%");
      assert.ok(decision.errorRatePercent < 0.1);
      assert.equal(decision.sha256Proof.length, 64);
    });

    it("triggers fail-closed ROLLBACK when error rate exceeds 0.10% threshold", () => {
      const decision = evaluateCanaryStage({
        stage: "5%",
        trafficPercentage: 5,
        totalRequests: 20000,
        errorCount: 45, // 0.225% error rate (> 0.10%)
        p99LatencyMs: 28,
        maxAllowedP99Ms: 50,
        observationWindowMinutes: 15,
      });

      assert.equal(decision.decision, "TRIGGER_ROLLBACK");
      assert.equal(decision.killSwitchEngaged, true);
      assert.equal(decision.nextStage, null);
      assert.ok(decision.reason.includes("exceeds 0.10% threshold"));
    });

    it("triggers fail-closed ROLLBACK when p99 latency spikes above budget", () => {
      const decision = evaluateCanaryStage({
        stage: "25%",
        trafficPercentage: 25,
        totalRequests: 100000,
        errorCount: 10, // 0.01% error rate
        p99LatencyMs: 78, // > 50ms budget
        maxAllowedP99Ms: 50,
        observationWindowMinutes: 60,
      });

      assert.equal(decision.decision, "TRIGGER_ROLLBACK");
      assert.equal(decision.killSwitchEngaged, true);
      assert.equal(decision.nextStage, null);
      assert.ok(decision.reason.includes("exceeds 50ms budget"));
    });
  });

  describe("Suite 4: Fleetshift Mass-Migration Planner", () => {
    it("generates deterministic fleet transformation tasks and PR manifests", () => {
      const plan = planFleetshiftMigration({
        migrationId: "MIG-2026-GO-DISTROLESS",
        description: "Migrate fleet services to Distroless Go binaries under 12MB",
        targetRepos: [
          { id: "repo-01", name: "eos-system" },
          { id: "repo-02", name: "aberamentho" },
          { id: "repo-03", name: "portafolio" },
        ],
        action: "apply_distroless_container",
      });

      assert.equal(plan.migrationId, "MIG-2026-GO-DISTROLESS");
      assert.equal(plan.totalReposTargeted, 3);
      assert.equal(plan.tasks.length, 3);
      assert.equal(plan.tasks[0].targetBranch, "fleetshift/MIG-2026-GO-DISTROLESS");
      assert.ok(plan.tasks[0].automatedPrTitle.includes("Distroless"));
      assert.equal(plan.sha256Proof.length, 64);
    });
  });
});
