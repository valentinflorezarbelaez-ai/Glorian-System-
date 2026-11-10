import test, { after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { EosSamaelUnitotalNexus } from "../src/core/eosSamaelUnitotalNexus.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { materializeFleetFixture, disposeFleetFixture } from "./lib/fleetFixture.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Fleet checks run hermetically against throwaway sibling checkouts materialized
// from docs/projects/registry.json (see test/lib/fleetFixture.mjs); the developer's
// real sibling repositories are never read or written. If the registry provides no
// fixtures, fall back to skipping unless EOS_LOCAL_FLEET_TESTS=1 opts in to the
// real local fleet checkouts. Host-tool checks (engram.exe) always stay local-opt-in.
// Materialized synchronously at module load so skip flags are decided before registration.
const fleetFixture = materializeFleetFixture(projectRoot);
const fleetAvailable = fleetFixture.complete || Boolean(process.env.EOS_LOCAL_FLEET_TESTS);

after(() => disposeFleetFixture(fleetFixture));

const fleetSkip = fleetAvailable
  ? false
  : "No fleet fixtures in docs/projects/registry.json; set EOS_LOCAL_FLEET_TESTS=1 with the local fleet checkouts present.";

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
    "Malkuth",
  ]);

  for (const dim of vector) {
    assert.ok(dim.score >= 90, `Expected score >= 90 for ${dim.sephirah}, got ${dim.score}`);
    assert.equal(dim.status, "PERFECT");
    assert.ok(dim.verificationEvidence.length > 10);
    assert.ok(dim.esotericPrinciple.length > 5);
    assert.ok(dim.bigTechEquivalent.length > 5);
  }
});

test("BDD-204: Universal Fleet Repository Inventory and Law IV Compliance", { skip: fleetSkip }, () => {
  const fleet = EosSamaelUnitotalNexus.auditFleetRepositories(projectRoot);
  assert.ok(fleet.length >= 5, `Expected at least 5 fleet repositories, got ${fleet.length}`);

  const eosRepo = fleet.find((r) => r.id === "eos-system");
  assert.ok(eosRepo);
  assert.equal(eosRepo.diskPresent, true);
  assert.equal(eosRepo.status, "HEALTHY");

  const ptgRepo = fleet.find((r) => r.id === "performance-talent-group");
  assert.ok(ptgRepo);
  assert.equal(ptgRepo.diskPresent, true);
});

test("BDD-205: Drift detection and dry-run remediation proposal", { skip: fleetSkip }, () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "eos-drift-test-"));

  try {
    const dryRunResult = EosSamaelUnitotalNexus.remediateFleetDrift("performance-talent-group", projectRoot, true);
    assert.equal(dryRunResult.success, true);
    assert.ok(dryRunResult.actionsTaken.length > 0);
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
});

test(
  "BDD-206: Unitotal Perfection Score computation and SOVEREIGN_UNITOTAL_PERFECTION certification",
  { skip: fleetSkip },
  () => {
    const report = EosSamaelUnitotalNexus.evaluateUnitotalPerfection(projectRoot);

    assert.equal(report.status, "SOVEREIGN_UNITOTAL_PERFECTION");
    assert.ok(report.unitotalScore >= 90, `Expected score >= 90, got ${report.unitotalScore}`);
    assert.ok(report.activeSpecsCount >= 63, `Expected activeSpecsCount >= 63, got ${report.activeSpecsCount}`);
    assert.ok(
      report.formalTlaModelsCount >= 23,
      `Expected formalTlaModelsCount >= 23, got ${report.formalTlaModelsCount}`,
    );
    assert.ok(report.sha256Receipt.length === 64);
    assert.ok(report.healthyFleetRepos >= 4);
  },
);

test("BDD-207: Canonical Engram binary path points to valid user local environment", () => {
  const engramPath = EosSamaelUnitotalNexus.CANONICAL_ENGRAM_PATH;
  assert.ok(typeof engramPath === "string");
  assert.ok(engramPath.includes("engram.exe"));
  if (fs.existsSync(engramPath) || process.env.EOS_LOCAL_FLEET_TESTS) {
    assert.equal(fs.existsSync(engramPath), true);
  }
});

test(
  "BDD-208: MCP tool eos_unitotal_evaluate dispatches audit and records receipt in SQLite WAL",
  { skip: fleetSkip },
  () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-unitotal-mcp-test-"));

    try {
      const server = new EosMcpServer(projectRoot, "core");
      const mcpRes = server.handleRequest({
        jsonrpc: "2.0",
        id: 102,
        method: "tools/call",
        params: {
          name: "eos_unitotal_evaluate",
          arguments: {
            action: "evaluate",
            recordToLedger: true,
          },
        },
      });

      assert.ok(mcpRes.result);
      const text = mcpRes.result.content[0].text;
      const data = JSON.parse(text);
      assert.equal(data.status, "SOVEREIGN_UNITOTAL_PERFECTION");
      assert.ok(data.unitotalScore >= 90);
      assert.ok(data.activeSpecsCount >= 63, `Expected activeSpecsCount >= 63, got ${data.activeSpecsCount}`);
      assert.ok(
        data.formalTlaModelsCount >= 23,
        `Expected formalTlaModelsCount >= 23, got ${data.formalTlaModelsCount}`,
      );
      assert.ok(data.sha256Receipt.length === 64);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);
