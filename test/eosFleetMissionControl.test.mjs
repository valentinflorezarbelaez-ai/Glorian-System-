import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosFleetMissionControl } from "../src/core/eosFleetMissionControl.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("SPEC-125: EOS Fleet Mission Control Dashboard & Synthetic Health Sentinel", () => {
  const missionControl = new EosFleetMissionControl(projectRoot);

  describe("BDD-368: Dynamic Fleet Telemetry Retrieval", () => {
    it("retrieves the complete fleet inventory of 10 projects", () => {
      const overview = missionControl.getFleetOverview();
      assert.ok(Array.isArray(overview));
      assert.equal(overview.length, 10, "Expected exactly 10 projects in fleet");

      const ids = overview.map((p) => p.id);
      assert.ok(ids.includes("eos-system"));
      assert.ok(ids.includes("control-de-asistencia-abopack"));
      assert.ok(ids.includes("atp-strength"));
      assert.ok(ids.includes("biblioteca-gnostica-1"));
      assert.ok(ids.includes("crud-slack"));
      assert.ok(ids.includes("aberamentho"));
      assert.ok(ids.includes("performance-talent-group"));
      assert.ok(ids.includes("portafolio"));
      assert.ok(ids.includes("donaciones"));
      assert.ok(ids.includes("kegel-ham-sah"));
    });
  });

  describe("BDD-370: Hermetic Execution Safeguard (No Network in CI Default)", () => {
    it("generates a complete report without external network probing in hermetic mode", async () => {
      const start = Date.now();
      const report = await missionControl.generateReport({ probe: false });
      const durationMs = Date.now() - start;

      // Hang guard, not an SLA: coverage instrumentation inflates hermetic runs.
      assert.ok(durationMs < 15000, `Hermetic report hung: took ${durationMs}ms`);
      assert.equal(report.totalProjects, 10);
      assert.equal(report.productionEndpointsCount, 10);
      assert.equal(report.healthyEndpointsCount, 10);
      assert.ok(/^[0-9a-f]{64}$/.test(report.registrySha256));
    });
  });

  describe("BDD-371: Biblioteca Gnóstica & ATP Strength Level 3 Verification", () => {
    it("confirms biblioteca-gnostica-1 and atp-strength are elevated to LEVEL_3_PRODUCTION_AUTHORIZED", () => {
      const overview = missionControl.getFleetOverview();
      
      const bg = overview.find((p) => p.id === "biblioteca-gnostica-1");
      assert.ok(bg, "Must find biblioteca-gnostica-1");
      assert.equal(bg.authorization, "LEVEL_3_PRODUCTION_AUTHORIZED");
      assert.equal(bg.productionUrl, "https://biblioteca-gnostica.vercel.app");
      assert.equal(bg.status, "REGISTERED");

      const atp = overview.find((p) => p.id === "atp-strength");
      assert.ok(atp, "Must find atp-strength");
      assert.equal(atp.authorization, "LEVEL_3_PRODUCTION_AUTHORIZED");
      assert.equal(atp.productionUrl, "https://atp-strength.vercel.app");
      assert.equal(atp.status, "REGISTERED");
    });
  });

  describe("BDD-369: Synthetic Latency & Status Probe Functionality", () => {
    it("handles invalid or empty URLs gracefully without throwing", async () => {
      const probe1 = await EosFleetMissionControl.probeEndpoint("");
      assert.equal(probe1.reachable, false);
      assert.equal(probe1.error, "INVALID_URL");

      const probe2 = await EosFleetMissionControl.probeEndpoint("not-a-valid-url");
      assert.equal(probe2.reachable, false);
      assert.equal(probe2.error, "INVALID_URL");
    });
  });

  describe("BDD-372: MCP Tool Dispatch (eos_fleet_mission_control)", async () => {
    it("dispatches eos_fleet_mission_control tool via EosMcpServer in hermetic mode", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer(projectRoot, "full");
      const response = server.handleRequest({
        jsonrpc: "2.0",
        id: 125,
        method: "tools/call",
        params: {
          name: "eos_fleet_mission_control",
          arguments: {
            probe: false
          }
        }
      });

      assert.ok(response, "Must receive a JSON-RPC response");
      assert.equal(response.id, 125);
      assert.ok(response.result, "Must contain result");
      assert.ok(Array.isArray(response.result.content));
      const body = JSON.parse(response.result.content[0].text);
      assert.equal(body.totalProjects, 10);
      assert.equal(body.productionEndpointsCount, 10);
      assert.ok(/^[0-9a-f]{64}$/.test(body.registrySha256));
    });
  });
});
