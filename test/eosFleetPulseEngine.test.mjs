import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosFleetPulseEngine } from "../src/core/eosFleetPulseEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-340: EosFleetPulseEngine audits all 9 fleet repositories and verifies health quorum", () => {
  const engine = new EosFleetPulseEngine(root);
  const report = engine.auditFleetPulse();

  assert.equal(report.totalProjects, 9, "Expected exactly 9 projects in registry");
  assert.ok(report.localProjectsFound >= 1, `Expected at least 1 local project (self), got ${report.localProjectsFound}`);
  if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
    assert.ok(report.localProjectsFound >= 8, `Expected at least 8 local projects on workstation, got ${report.localProjectsFound}`);
    assert.ok(report.fleetHealthQuorumPercentage >= 85, `Expected quorum >=85%, got ${report.fleetHealthQuorumPercentage}%`);
  } else {
    assert.ok(report.fleetHealthQuorumPercentage >= 10, `Expected quorum >=10% in isolated CI runner, got ${report.fleetHealthQuorumPercentage}%`);
  }
  assert.ok(report.sha256Receipt.length === 64, "Expected valid 64-character SHA-256 seal");
  assert.ok(report.durationMs >= 0);
  assert.equal(report.projects.length, 9);
});

test("BDD-341: EosFleetPulseEngine maps esoteric-gnostic archetypes to every sovereign project", () => {
  const engine = new EosFleetPulseEngine(root);
  const report = engine.auditFleetPulse();

  const eosProj = report.projects.find((p) => p.id === "eos-system");
  assert.ok(eosProj);
  assert.ok(eosProj.esotericArchetype.includes("Sol Central"), "eos-system must map to Sol Central / Glorian Core");

  const atpProj = report.projects.find((p) => p.id === "atp-strength");
  assert.ok(atpProj);
  assert.ok(atpProj.esotericArchetype.includes("HAM-SAH"), "atp-strength must map to HAM-SAH / Prana");

  const gnosticaProj = report.projects.find((p) => p.id === "biblioteca-gnostica-1");
  assert.ok(gnosticaProj);
  assert.ok(gnosticaProj.esotericArchetype.includes("Primer Factor"), "biblioteca-gnostica-1 must map to Primer Factor / Gnosis");

  const donacionesProj = report.projects.find((p) => p.id === "donaciones");
  assert.ok(donacionesProj);
  assert.ok(donacionesProj.esotericArchetype.includes("Tercer Factor"), "donaciones must map to Tercer Factor");
});

test("BDD-342: formatPulseTable generates high-density ANSI terminal output", () => {
  const engine = new EosFleetPulseEngine(root);
  const report = engine.auditFleetPulse();
  const table = EosFleetPulseEngine.formatPulseTable(report);

  assert.ok(table.includes("GLORIAN FLEET TACTICAL SOVEREIGNTY RADAR"));
  assert.ok(table.includes("Quorum:"));
  assert.ok(table.includes("aberamentho"));
  assert.ok(table.includes("eos-system"));
  assert.ok(table.includes("atp-strength"));
  assert.ok(table.includes("Production: https://"));
  assert.ok(table.includes("ALL 9 REPOSITORIES GOVERNED"));
});

test("BDD-343: EosMcpServer dispatches eos_fleet_pulse for both json and table formats", () => {
  const server = new EosMcpServer(root);

  // 1. JSON format
  const jsonRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 991,
    method: "tools/call",
    params: {
      name: "eos_fleet_pulse",
      arguments: {
        format: "json"
      }
    }
  });

  assert.ok(jsonRes?.result?.content?.[0]?.text);
  const jsonParsed = JSON.parse(jsonRes.result.content[0].text);
  assert.equal(jsonParsed.totalProjects, 9);
  if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
    assert.ok(jsonParsed.fleetHealthQuorumPercentage >= 85);
  } else {
    assert.ok(jsonParsed.fleetHealthQuorumPercentage >= 10);
  }

  // 2. Table format
  const tableRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 992,
    method: "tools/call",
    params: {
      name: "eos_fleet_pulse",
      arguments: {
        format: "table"
      }
    }
  });

  assert.ok(tableRes?.result?.content?.[0]?.text);
  const tableParsed = JSON.parse(tableRes.result.content[0].text);
  assert.equal(tableParsed.totalProjects, 9);
  assert.ok(tableParsed.table.includes("GLORIAN FLEET TACTICAL SOVEREIGNTY RADAR"));
});
