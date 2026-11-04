/**
 * BDD — Control plane health probes + SPEC-155 Phase-4 institutional MCP extract
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runControlPlaneHealthProbes } from "../src/core/eosControlPlaneHealthProbes.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { PHASE4_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpPhase4InstitutionalHandlers.ts";
import {
  PHASE5_MIGRATED_TOOL_NAMES,
  PHASE5_PURGED_DEAD_SWITCH_ARMS
} from "../src/mcp/tools/eosMcpPhase5ToolNames.ts";
import { PHASE6_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpPhase6ToolNames.ts";
import { PHASE7_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpPhase7ToolNames.ts";
import { evaluateSovereignFiveScorecard } from "../src/core/eosSovereignFiveScorecard.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("BDD-481 Control plane health probes return WITHIN_TESTED_SCOPE report", () => {
  const report = runControlPlaneHealthProbes(projectRoot);
  assert.equal(report.epistemicState, "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE");
  assert.ok(["HEALTHY", "DEGRADED", "CRITICAL"].includes(report.status));
  assert.equal(report.probesTotal, 6);
  assert.ok(report.probesPassing >= 4);
  assert.ok(report.claimsDenied.includes("Level 5"));
  assert.ok(report.sha256Receipt.length === 64);
  const ids = report.probes.map((p) => p.id);
  assert.ok(ids.includes("LAYER0_RUNTIME_DEPS"));
  assert.ok(ids.includes("TIP_SEAL_PIN"));
});

test("BDD-482 eos_health_check MCP path runs subsystem probes", () => {
  const server = new EosMcpServer(projectRoot, "core");
  const res = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: {} }
  });
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.subsystemProbes, "RUN");
  assert.equal(payload.epistemicState, "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE");
  assert.ok(payload.probesTotal >= 6);
});

test("BDD-483 Phase-4 institutional tools dispatch via registry", () => {
  assert.equal(PHASE4_MIGRATED_TOOL_NAMES.length, 11);
  const server = new EosMcpServer(projectRoot, "full");
  const source = path.join(projectRoot, "src/mcp/eosMcpServer.ts");
  // Migrated cases must not remain as live switch arms
  const god = fs.readFileSync(source, "utf8");
  for (const name of PHASE4_MIGRATED_TOOL_NAMES) {
    assert.equal(
      god.includes(`case "${name}"`),
      false,
      `god-file still has live case for ${name}`
    );
  }

  const canary = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_spotify_canary_gate",
      arguments: {
        stage: "5%",
        trafficPercentage: 5,
        totalRequests: 1000,
        errorCount: 0,
        p99LatencyMs: 20
      }
    }
  });
  assert.ok(canary?.result?.content?.[0]?.text);
  const canaryPayload = JSON.parse(canary.result.content[0].text);
  assert.ok(canaryPayload);

  const doctrine = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "eos_planetary_doctrine_audit", arguments: { format: "summary" } }
  });
  const doctrinePayload = JSON.parse(doctrine.result.content[0].text);
  assert.ok(doctrinePayload.sha256Receipt || doctrinePayload.overallScore !== undefined);

  const slsa = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "eos_slsa_provenance_sbom", arguments: { mode: "verify", recordToLedger: false } }
  });
  const slsaPayload = JSON.parse(slsa.result.content[0].text);
  assert.ok(slsaPayload.verification);
});

test("BDD-484 Phase-5 Spotify domain extract + dead glorian purge", () => {
  assert.equal(PHASE5_MIGRATED_TOOL_NAMES.length, 12);
  assert.equal(PHASE5_PURGED_DEAD_SWITCH_ARMS.length, 2);
  const server = new EosMcpServer(projectRoot, "full");
  const god = fs.readFileSync(path.join(projectRoot, "src/mcp/eosMcpServer.ts"), "utf8");
  for (const name of [...PHASE5_MIGRATED_TOOL_NAMES, ...PHASE5_PURGED_DEAD_SWITCH_ARMS]) {
    assert.equal(god.includes(`case "${name}"`), false, `god-file still has live case for ${name}`);
  }

  const shuffle = server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "eos_spotify_shuffle", arguments: { seed: 42108 } }
  });
  assert.ok(shuffle?.result?.content?.[0]?.text);
  const shufflePayload = JSON.parse(shuffle.result.content[0].text);
  assert.ok(shufflePayload);

  const audit = server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "eos_spotify_audit", arguments: { targetPath: "." } }
  });
  assert.ok(audit?.result?.content?.[0]?.text);
});

test("BDD-485 Phase-6 domain extract + Sovereign 5/5 within tested scope", () => {
  assert.equal(PHASE6_MIGRATED_TOOL_NAMES.length, 25);
  const god = fs.readFileSync(path.join(projectRoot, "src/mcp/eosMcpServer.ts"), "utf8");
  for (const name of PHASE6_MIGRATED_TOOL_NAMES) {
    assert.equal(god.includes(`case "${name}"`), false, `god-file still has live case for ${name}`);
  }
  const server = new EosMcpServer(projectRoot, "full");
  const pulse = server.handleRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "eos_fleet_pulse", arguments: {} }
  });
  assert.ok(pulse?.result?.content?.[0]?.text);

  const five = evaluateSovereignFiveScorecard(projectRoot);
  assert.equal(five.grade, "5/5");
  assert.equal(five.epistemicState, "SOVEREIGN_5_OF_5_WITHIN_TESTED_SCOPE");
  assert.ok(five.claimsDenied.includes("Level 5"));
  assert.ok(five.migratedTools >= 70);
  assert.ok(five.locCutPercentVsPeak >= 10);
});

test("BDD-486 Phase-7 largest residual extract hits T7c −25% LOC", () => {
  assert.equal(PHASE7_MIGRATED_TOOL_NAMES.length, 29);
  const godPath = path.join(projectRoot, "src/mcp/eosMcpServer.ts");
  const god = fs.readFileSync(godPath, "utf8");
  const godLines = god.split(/\r?\n/).length;
  assert.ok(godLines <= 5341, `god-file ${godLines} LOC must be ≤5341`);
  for (const name of PHASE7_MIGRATED_TOOL_NAMES) {
    assert.equal(god.includes(`case "${name}"`), false, `god-file still has live case for ${name}`);
  }
  const server = new EosMcpServer(projectRoot, "full");
  const wal = server.handleRequest({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "eos_wal_status", arguments: {} }
  });
  assert.ok(wal?.result?.content?.[0]?.text);

  const five = evaluateSovereignFiveScorecard(projectRoot);
  assert.equal(five.grade, "5/5");
  assert.ok(five.locCutPercentVsPeak >= 25);
  assert.ok(five.migratedTools >= 100);
  assert.ok(fs.existsSync(path.join(projectRoot, ".engram/config.json")));
});
