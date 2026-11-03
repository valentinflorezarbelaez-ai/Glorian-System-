/**
 * Specification Test Suite for SPEC-134: Glorian Sovereign Fleet Health Watchdog
 * Acceptance Criteria: BDD-353, BDD-354, BDD-355
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GlorianFleetHealthWatchdog } from "../src/core/glorianFleetHealthWatchdog.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-353: Anti-SSRF Protection & Target URL Validation", () => {
  const watchdog = new GlorianFleetHealthWatchdog(root);

  // Private and metadata targets must be blocked immediately
  const blockedTargets = [
    "http://127.0.0.1:8080/internal",
    "http://localhost:3000",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/admin",
    "http://192.168.1.100/status",
    "http://172.16.0.1/metrics"
  ];

  for (const target of blockedTargets) {
    const isSafe = watchdog.validateTargetSafety(target);
    assert.equal(isSafe.allowed, false, `Target ${target} must be flagged as unsafe`);
    assert.equal(isSafe.reason, "SSRF_QUARANTINE_BLOCKED");
  }

  // Public HTTPS targets must pass
  const validTargets = [
    "https://glorian-system.vercel.app",
    "https://crud-slack.vercel.app",
    "https://avo-pack.vercel.app",
    "https://donaciones-drab.vercel.app"
  ];

  for (const target of validTargets) {
    const isSafe = watchdog.validateTargetSafety(target);
    assert.equal(isSafe.allowed, true, `Valid public target ${target} must be allowed`);
  }
});

test("BDD-354: Synthetic Probing & Security Header Conformance", () => {
  const watchdog = new GlorianFleetHealthWatchdog(root);

  // Test header evaluation
  const mockHeadersCompliant = {
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'self'"
  };

  const score100 = watchdog.evaluateSecurityHeaders(mockHeadersCompliant);
  assert.equal(score100.score, 100);
  assert.equal(score100.hasHsts, true);
  assert.equal(score100.hasNosniff, true);

  const mockHeadersWeak = {
    "server": "vercel"
  };

  const scoreLow = watchdog.evaluateSecurityHeaders(mockHeadersWeak);
  assert.ok(scoreLow.score < 50);
  assert.equal(scoreLow.hasHsts, false);
  assert.equal(scoreLow.hasNosniff, false);

  // Test report generation with mock probe results
  const report = watchdog.evaluateFleetHealth([
    {
      projectId: "glorian-system",
      url: "https://glorian-system.vercel.app",
      status: 200,
      ttfbMs: 42,
      securityScore: 100
    },
    {
      projectId: "crud-slack",
      url: "https://crud-slack.vercel.app",
      status: 200,
      ttfbMs: 38,
      securityScore: 100
    }
  ]);

  assert.equal(report.totalProjectsEvaluated, 2);
  assert.equal(report.healthyProjectsCount, 2);
  assert.equal(report.compositeHealthIndex, 100);
  assert.equal(report.sha256Receipt.length, 64);

  const formatted = watchdog.formatHealthReport(report);
  assert.ok(formatted.includes("GLORIAN FLEET HEALTH WATCHDOG"));
  assert.ok(formatted.includes("Composite Health: 100%"));
});

test("BDD-355: MCP Tool Dispatch & Cryptographic Attestation", async () => {
  const mcpServer = new EosMcpServer();

  // Verify tool presence in tools/list
  const toolsResponse = await mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  const tools = toolsResponse.result?.tools || [];
  const watchdogTool = tools.find((t) => t.name === "glorian_fleet_health_watchdog");
  assert.ok(watchdogTool, "glorian_fleet_health_watchdog tool must be exposed via MCP");

  // Dispatch tool in simulated mode
  const callResponse = await mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "glorian_fleet_health_watchdog",
      arguments: {
        dryRun: true
      }
    }
  });

  assert.ok(callResponse.result);
  assert.ok(!callResponse.error);
  const payload = JSON.parse(callResponse.result?.content[0]?.text);
  assert.equal(payload.auditStatus, "FLEET_HEALTH_CERTIFIED");
  assert.ok(payload.totalProjectsEvaluated >= 9, "Must evaluate at least 9 fleet projects");
  assert.equal(payload.sha256Receipt.length, 64);
});
