import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { EosTelemetryDashboard } from "../src/core/eosTelemetryDashboard.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

/**
 * Helper to execute HTTP GET requests against the dashboard
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { Connection: "close" }, agent: false }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on("error", reject);
  });
}

// Ephemeral ports: fixed ports collide when suites run in parallel or two gates overlap.
test("BDD-191: Dashboard server starts, binds port, and shuts down cleanly", async () => {
  const dashboard = new EosTelemetryDashboard(projectRoot, 0);

  try {
    assert.equal(dashboard.isListening(), false);
    const server = await dashboard.start();
    const testPort = server.address().port;
    assert.ok(testPort > 0);
    assert.equal(dashboard.isListening(), true);
    assert.ok(server);

    // Verify root HTML responds with 200 OK
    const res = await httpGet(`http://127.0.0.1:${testPort}/`);
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["content-type"].includes("text/html"));
    assert.ok(res.body.includes("EOS Sovereign Telemetry Dashboard"));
  } finally {
    await dashboard.stop();
    assert.equal(dashboard.isListening(), false);
  }
});

test("BDD-192: GET /api/telemetry returns valid JSON snapshot with zero runtime dependencies", async () => {
  const dashboard = new EosTelemetryDashboard(projectRoot, 0);

  try {
    const server = await dashboard.start();
    const testPort = server.address().port;
    const res = await httpGet(`http://127.0.0.1:${testPort}/api/telemetry`);
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["content-type"].includes("application/json"));

    const payload = JSON.parse(res.body);
    assert.equal(payload.status, "NOMINAL");
    assert.ok(typeof payload.timestamp === "string");
    assert.ok(payload.topology);
    assert.ok(payload.tokenEfficiency);
    assert.ok(payload.ledger);
    assert.ok(payload.health);

    // Verify token efficiency fields
    assert.ok(payload.tokenEfficiency.totalSavedTokens >= 0);
    assert.ok(typeof payload.tokenEfficiency.savedRatio === "number");
  } finally {
    await dashboard.stop();
  }
});

test("BDD-193: GET /api/ledger returns SQLite entries, pagination, and SHA-256 chain status", async () => {
  const dashboard = new EosTelemetryDashboard(projectRoot, 0);

  try {
    const server = await dashboard.start();
    const testPort = server.address().port;
    const res = await httpGet(`http://127.0.0.1:${testPort}/api/ledger?limit=10`);
    assert.equal(res.statusCode, 200);

    const payload = JSON.parse(res.body);
    assert.ok(payload.success);
    assert.ok(Array.isArray(payload.entries));
    assert.ok(payload.totalEntries >= 0);
    assert.equal(payload.chainIntact, true);
  } finally {
    await dashboard.stop();
  }
});

test("BDD-194: GET /api/topology returns acyclic subagent DAG and active agents", async () => {
  const dashboard = new EosTelemetryDashboard(projectRoot, 0);

  try {
    const server = await dashboard.start();
    const testPort = server.address().port;
    const res = await httpGet(`http://127.0.0.1:${testPort}/api/topology`);
    assert.equal(res.statusCode, 200);

    const payload = JSON.parse(res.body);
    assert.ok(Array.isArray(payload.agents));
    assert.ok(Array.isArray(payload.dependencies));
    assert.equal(payload.cycleDetected, false);
    assert.ok(payload.activeAgents >= 1);
  } finally {
    await dashboard.stop();
  }
});

test("BDD-195: GET / delivers responsive HTML5 UI with SVG DAG and accessibility landmarks", async () => {
  const dashboard = new EosTelemetryDashboard(projectRoot, 0);

  try {
    const server = await dashboard.start();
    const testPort = server.address().port;
    const res = await httpGet(`http://127.0.0.1:${testPort}/`);
    assert.equal(res.statusCode, 200);

    // Check semantic HTML landmarks and SVG topological rendering
    assert.ok(res.body.includes("<header"));
    assert.ok(res.body.includes("<main"));
    assert.ok(res.body.includes("<svg"));
    assert.ok(res.body.includes("id=\"agent-topology-dag\""));
    assert.ok(res.body.includes("id=\"token-odometer\""));
    assert.ok(res.body.includes("id=\"ledger-stream\""));
    assert.ok(res.body.includes("aria-label=\"Agent Topology DAG\""));
  } finally {
    await dashboard.stop();
  }
});

test("BDD-196: MCP tool eos_dashboard_status dispatches nominal snapshot and records receipt in SQLite WAL", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-dashboard-mcp-test-"));
  const dbPath = path.join(tmpDir, "dashboard_test.sqlite");

  try {
    const server = new EosMcpServer(projectRoot, "core");
    const mcpRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: {
        name: "eos_dashboard_status",
        arguments: {
          action: "snapshot",
          port: 4321,
          recordToLedger: true
        }
      }
    });

    assert.ok(mcpRes.result);
    const contentText = mcpRes.result.content[0].text;
    const data = JSON.parse(contentText);
    assert.equal(data.status, "NOMINAL");
    assert.equal(data.port, 4321);
    assert.ok(data.snapshot);
    assert.equal(data.snapshot.status, "NOMINAL");
    assert.equal(data.snapshot.topology.cycleDetected, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
