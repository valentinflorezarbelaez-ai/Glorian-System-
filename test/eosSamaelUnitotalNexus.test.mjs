import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

import {
  EosSamaelUnitotalNexus
} from "../src/core/eosSamaelUnitotalNexus.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { createFleetFixture } from "./support/fleetFixture.mjs";

test("BDD-203: Evaluation of the 10-Sephiroth Architectural Integrity Vector", () => {
  const vector = EosSamaelUnitotalNexus.evaluateSephirothVector(63, 23);
  assert.equal(vector.length, 10);

  const sephirothNames = vector.map((d) => d.sephirah);
  assert.deepEqual(sephirothNames, [
    "Kether",
    "Chokmah",
    "Binah",
    "Chesed",
    "Geburah",
    "Tiphereth",
    "Netzach",
    "Hod",
    "Yesod",
    "Malkuth"
  ]);

  for (const dim of vector) {
    assert.ok(dim.score >= 90, `Expected score >= 90 for ${dim.sephirah}, got ${dim.score}`);
    assert.equal(dim.status, "PERFECT");
    assert.ok(dim.verificationEvidence.length > 10);
    assert.ok(dim.esotericPrinciple.length > 5);
    assert.ok(dim.bigTechEquivalent.length > 5);
  }
});

test("BDD-204: Universal Fleet Repository Inventory and Law IV Compliance", () => {
  const fixture = createFleetFixture();

  try {
    const fleet = EosSamaelUnitotalNexus.auditFleetRepositories(fixture.root);
    assert.equal(fleet.length, 10);
    assert.ok(fleet.length >= 5, `Expected at least 5 fleet repositories, got ${fleet.length}`);

    const eosRepo = fleet.find((r) => r.id === "eos-system");
    assert.ok(eosRepo);
    assert.equal(eosRepo.diskPresent, true);
    assert.equal(eosRepo.status, "HEALTHY");

    const ptgRepo = fleet.find((r) => r.id === "performance-talent-group");
    assert.ok(ptgRepo);
    assert.equal(ptgRepo.diskPresent, true);
    assert.equal(ptgRepo.hasMcpConfig, true);
    assert.equal(ptgRepo.hasOpenSpec, true);
    assert.match(ptgRepo.lawIvAuthorization, /^LEVEL_[23]/);
  } finally {
    fixture.cleanup();
  }
});

test("BDD-205: Drift detection and dry-run remediation proposal", () => {
  const fixture = createFleetFixture();

  try {
    const targetRepo = "performance-talent-group";
    const mcpFile = path.join(fixture.root, "repos", targetRepo, ".cursor", "mcp.json");
    fs.rmSync(mcpFile, { force: true });

    const drifted = EosSamaelUnitotalNexus.auditFleetRepositories(fixture.root).find(
      (r) => r.id === targetRepo
    );
    assert.ok(drifted);
    assert.equal(drifted.status, "DRIFT_DETECTED");

    const dryRunResult = EosSamaelUnitotalNexus.remediateFleetDrift(targetRepo, fixture.root, true);
    assert.equal(dryRunResult.success, true);
    assert.ok(dryRunResult.actionsTaken.length > 0);
    assert.equal(fs.existsSync(mcpFile), false, "Dry-run must not write to disk");

    const appliedResult = EosSamaelUnitotalNexus.remediateFleetDrift(targetRepo, fixture.root, false);
    assert.equal(appliedResult.success, true);
    assert.equal(fs.existsSync(mcpFile), true, "Remediation must materialize .cursor/mcp.json");
  } finally {
    fixture.cleanup();
  }
});

test("BDD-206: Unitotal Perfection Score computation and SOVEREIGN_UNITOTAL_PERFECTION certification", () => {
  const fixture = createFleetFixture();
  try {
    const report = EosSamaelUnitotalNexus.evaluateUnitotalPerfection(fixture.root);

    assert.equal(report.status, "SOVEREIGN_UNITOTAL_PERFECTION");
    assert.ok(report.unitotalScore >= 90, `Expected score >= 90, got ${report.unitotalScore}`);
    assert.ok(report.healthyFleetRepos >= 4);
    assert.ok(report.activeSpecsCount >= 63, `Expected activeSpecsCount >= 63, got ${report.activeSpecsCount}`);
    assert.ok(report.formalTlaModelsCount >= 23, `Expected formalTlaModelsCount >= 23, got ${report.formalTlaModelsCount}`);
    assert.ok(report.sha256Receipt.length === 64);
  } finally {
    fixture.cleanup();
  }
});

test("BDD-207: Canonical Engram binary path points to valid user local environment", () => {
  const engramPath = EosSamaelUnitotalNexus.CANONICAL_ENGRAM_PATH;
  assert.ok(typeof engramPath === "string");
  assert.ok(engramPath.includes("engram.exe"));
});

test("BDD-208: MCP tool eos_unitotal_evaluate dispatches audit and records receipt in SQLite WAL", () => {
  const fixture = createFleetFixture();

  try {
    const server = new EosMcpServer(fixture.root, "core");
    const mcpRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: {
        name: "eos_unitotal_evaluate",
        arguments: {
          action: "evaluate",
          recordToLedger: true
        }
      }
    });

    assert.ok(mcpRes.result);
    const text = mcpRes.result.content[0].text;
    const data = JSON.parse(text);
    assert.equal(data.status, "SOVEREIGN_UNITOTAL_PERFECTION");
    assert.ok(data.unitotalScore >= 90);
    assert.ok(data.activeSpecsCount >= 63, `Expected activeSpecsCount >= 63, got ${data.activeSpecsCount}`);
    assert.ok(data.formalTlaModelsCount >= 23, `Expected formalTlaModelsCount >= 23, got ${data.formalTlaModelsCount}`);
    assert.ok(data.sha256Receipt.length === 64);
  } finally {
    fixture.cleanup();
  }
});
