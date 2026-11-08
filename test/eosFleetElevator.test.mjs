import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosFleetElevator } from "../src/core/eosFleetElevator.ts";
import { EosFleetSoundcheckMesh } from "../src/core/eosFleetSoundcheckMesh.ts";

describe("EOS Sovereign Fleet Golden Path Elevator Suite", () => {
  const root = process.cwd();
  const elevator = new EosFleetElevator(root);

  describe("Suite 1: Fleet Elevation Audit & Golden Path Index (BDD-044)", () => {
    it("audits all registered fleet repositories in dry-run mode", () => {
      const report = elevator.elevateFleet({ dryRun: true });
      assert.ok(report.totalProjects >= 4, `Expected at least 4 registered projects, got ${report.totalProjects}`);
      assert.ok(
        report.meanLocalInventoryScore >= 0,
        `Expected local score >= 0, got ${report.meanLocalInventoryScore}`,
      );
      assert.equal(report.projects.length, report.totalProjects);

      const eosCore = report.projects.find((p) => p.id === "eos-system");
      assert.ok(eosCore);
      assert.ok(eosCore.localInventoryScore >= 50);
      assert.equal(eosCore.catalogInfoStatus, "PRESENT_UNCHECKED");
    });

    it("evaluates target project elevation independently", () => {
      const report = elevator.elevateFleet({ dryRun: true, targetProject: "aberamentho" });
      assert.equal(report.totalProjects, 1);
      assert.equal(report.projects[0].id, "aberamentho");
      assert.equal(report.projects[0].pathExists, false);
      assert.equal(report.projects[0].localInventoryScore, 0);
    });
  });

  describe("Suite 2: Spotify Soundcheck Mesh Fleet Dimensions (BDD-119)", () => {
    it("audits all registered fleet repositories and verifies Grade A quorum", () => {
      const report = EosFleetSoundcheckMesh.auditFleet(root);
      assert.equal(report.totalRepositories, 9);
      assert.ok(report.fleetAverageScore >= 70, `Expected fleet average >= 70, got ${report.fleetAverageScore}`);
      assert.equal(report.deploymentAuthorizedQuorum, true);
      assert.ok(report.reposAtGradeA >= 5);
      assert.match(report.sha256Receipt, /^[0-9a-f]{64}$/);

      const eosRep = report.reports.find((r) => r.id === "eos-system");
      assert.ok(eosRep);
      assert.equal(eosRep.grade, "A+");
      assert.equal(eosRep.totalScore, 100);
      assert.equal(eosRep.eligibleForAutonomousDeploy, true);
    });

    it("falls back to default fleet repositories when projectRoot is omitted", () => {
      const fallbackReport = EosFleetSoundcheckMesh.auditFleet();
      assert.equal(fallbackReport.totalRepositories, 5);
      assert.ok(fallbackReport.fleetAverageScore >= 0);
      assert.match(fallbackReport.sha256Receipt, /^[0-9a-f]{64}$/);
    });
  });
});
