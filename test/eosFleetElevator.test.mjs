import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosFleetElevator } from "../src/core/eosFleetElevator.ts";

describe("EOS Sovereign Fleet Golden Path Elevator Suite", () => {
  const elevator = new EosFleetElevator(process.cwd());

  describe("Suite 1: Fleet Elevation Audit & Golden Path Index (BDD-044)", () => {
    it("audits all registered fleet repositories in dry-run mode", () => {
      const report = elevator.elevateFleet({ dryRun: true });
      assert.ok(report.totalProjects >= 4, `Expected at least 4 registered projects, got ${report.totalProjects}`);
      assert.ok(report.meanLocalInventoryScore >= 0, `Expected local score >= 0, got ${report.meanLocalInventoryScore}`);
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
});
