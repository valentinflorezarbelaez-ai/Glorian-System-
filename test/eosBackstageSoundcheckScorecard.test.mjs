/**
 * Spotify Backstage Soundcheck Real-Time Fleet Scorecards Test Suite
 *
 * Verifies BDD-1569..BDD-1574 for SPEC-299 / CHANGE-161.
 * Strict Zero Runtime Dependencies (Law V).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { BackstageSoundcheckEngine } from "../src/core/eosBackstageSoundcheckScorecard.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

test("BDD-1569: Five-Pillar Real-Time Fleet Scoring", () => {
  const engine = new BackstageSoundcheckEngine();
  const card = engine.scoreRepository("eos-system");

  assert.equal(card.projectId, "eos-system");
  assert.ok(card.overallScore >= 95);
  assert.equal(card.certificationTier, "LEVEL_4_PLATINUM");

  const pillars = card.pillars;
  assert.equal(pillars.LAW_V_CONFORMANCE.score, 100);
  assert.equal(pillars.LAW_V_CONFORMANCE.status, "CONFORMING");
  assert.equal(pillars.TEST_COVERAGE.score, 98);
  assert.equal(pillars.SECURITY_POSTURE.score, 100);
  assert.equal(pillars.SPECIFICATION_DRIFT.score, 100);
  assert.equal(pillars.DORA_VELOCITY.score, 95);
});

test("BDD-1570: Deterministic Maturity Certification Tier Assignment", () => {
  const engine = new BackstageSoundcheckEngine();

  // Test Platinum tier (overall >= 95, all pillars >= 90)
  const platinumCard = engine.scoreRepository("eos-system");
  assert.equal(platinumCard.certificationTier, "LEVEL_4_PLATINUM");

  // Test Gold tier
  const goldCard = engine.scoreRepository("aberamentho");
  assert.equal(goldCard.certificationTier, "LEVEL_3_GOLD");

  // Test Law V breach ceiling (forces LEVEL_1_BRONZE regardless of other scores)
  const breachCard = engine.scoreRepository("custom-repo", {
    pillars: {
      LAW_V_CONFORMANCE: {
        pillarId: "LAW_V_CONFORMANCE",
        name: "Law V Runtime Dependency Purity",
        score: 0,
        weight: 0.25,
        status: "BREACH",
        findings: ["External packages detected"],
      },
      TEST_COVERAGE: {
        pillarId: "TEST_COVERAGE",
        name: "Automated Test & PTS Coverage",
        score: 100,
        weight: 0.25,
        status: "CONFORMING",
        findings: [],
      },
      SECURITY_POSTURE: {
        pillarId: "SECURITY_POSTURE",
        name: "Zero Plain Secrets & Static Analysis",
        score: 100,
        weight: 0.2,
        status: "CONFORMING",
        findings: [],
      },
      SPECIFICATION_DRIFT: {
        pillarId: "SPECIFICATION_DRIFT",
        name: "OpenSpec Architectural Conformance",
        score: 100,
        weight: 0.15,
        status: "CONFORMING",
        findings: [],
      },
      DORA_VELOCITY: {
        pillarId: "DORA_VELOCITY",
        name: "DORA Engineering Velocity",
        score: 100,
        weight: 0.15,
        status: "CONFORMING",
        findings: [],
      },
    },
  });
  assert.equal(breachCard.certificationTier, "LEVEL_1_BRONZE");
});

test("BDD-1571: DORA Velocity Metrics Computation", () => {
  const engine = new BackstageSoundcheckEngine();

  const eosDora = engine.calculateDoraMetrics("eos-system");
  assert.equal(eosDora.tier, "ELITE");
  assert.equal(eosDora.meanTimeToRestoreMinutes, 5);
  assert.equal(eosDora.changeFailureRatePercent, 0.0);

  const fleetDora = engine.calculateDoraMetrics("aberamentho");
  assert.equal(fleetDora.tier, "HIGH");
  assert.equal(fleetDora.leadTimeForChanges, "< 1 day");
});

test("BDD-1572: Architectural Drift Detection and Remediation Generation", () => {
  const engine = new BackstageSoundcheckEngine();

  // Score with simulated drift in TEST_COVERAGE (< 80)
  const driftingCard = engine.scoreRepository("drifting-repo", {
    pillars: {
      LAW_V_CONFORMANCE: {
        pillarId: "LAW_V_CONFORMANCE",
        name: "Law V Runtime Dependency Purity",
        score: 100,
        weight: 0.25,
        status: "CONFORMING",
        findings: [],
      },
      TEST_COVERAGE: {
        pillarId: "TEST_COVERAGE",
        name: "Automated Test & PTS Coverage",
        score: 65,
        weight: 0.25,
        status: "BREACH",
        findings: ["3 failing test suites"],
      },
      SECURITY_POSTURE: {
        pillarId: "SECURITY_POSTURE",
        name: "Zero Plain Secrets & Static Analysis",
        score: 95,
        weight: 0.2,
        status: "CONFORMING",
        findings: [],
      },
      SPECIFICATION_DRIFT: {
        pillarId: "SPECIFICATION_DRIFT",
        name: "OpenSpec Architectural Conformance",
        score: 85,
        weight: 0.15,
        status: "WARNING",
        findings: [],
      },
      DORA_VELOCITY: {
        pillarId: "DORA_VELOCITY",
        name: "DORA Engineering Velocity",
        score: 85,
        weight: 0.15,
        status: "WARNING",
        findings: [],
      },
    },
  });

  assert.equal(driftingCard.driftDetected, true);
  assert.ok(driftingCard.remediationPlan.length >= 1);
  assert.ok(driftingCard.remediationPlan[0].includes("toolchain:soundcheck:drift"));
});

test("BDD-1573: Fleet-Wide Matrix Aggregation", () => {
  const expectedFleetCount = JSON.parse(readFileSync("docs/projects/registry.json", "utf8")).projects.length;
  const engine = new BackstageSoundcheckEngine();
  const matrix = engine.generateFleetMatrix();

  assert.equal(matrix.totalRepositoriesScored, expectedFleetCount);
  assert.ok(matrix.averageFleetScore >= 90);
  assert.equal(matrix.tierDistribution.LEVEL_4_PLATINUM, 1);
  assert.equal(matrix.tierDistribution.LEVEL_3_GOLD, expectedFleetCount - 1);
  assert.equal(matrix.scorecards.length, expectedFleetCount);
});

test("BDD-1574: Cryptographic Soundcheck Audit Receipt Generation", async () => {
  const expectedFleetCount = JSON.parse(readFileSync("docs/projects/registry.json", "utf8")).projects.length;
  const receiptPath = resolveEvidencePath("SOUNDCHECK_SCORECARD_RECEIPT.json");
  const engine = new BackstageSoundcheckEngine();
  const receipt = await engine.auditFleetSoundcheckPipeline({
    writeReceipt: true,
    receiptPath,
  });

  assert.equal(receipt.specRef, "SPEC-299");
  assert.equal(receipt.totalRepositoriesScored, expectedFleetCount);
  assert.ok(receipt.averageFleetScore >= 90);
  assert.equal(receipt.sha256Signature.length, 64);

  assert.ok(existsSync(receiptPath));
  const diskReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);
});
