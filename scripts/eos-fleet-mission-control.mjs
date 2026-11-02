#!/usr/bin/env node
/**
 * SPEC-125: EOS Fleet Mission Control CLI & Synthetic Health Sentinel
 *
 * Runs non-invasive health probes across all 9 registered projects in the fleet,
 * calculates average latency, and prints a high-density executive HUD.
 */

import path from "node:path";
import { EosFleetMissionControl } from "../src/core/eosFleetMissionControl.ts";

async function main() {
  const args = process.argv.slice(2);
  const shouldProbe = args.includes("--probe");
  const isJson = args.includes("--json");

  const mc = new EosFleetMissionControl(path.resolve("."));
  const report = await mc.generateReport({ probe: shouldProbe });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  console.log("======================================================================");
  console.log(" 🌐 EOS SYSTEM — SOVEREIGN FLEET MISSION CONTROL (SPEC-125)           ");
  console.log("======================================================================");
  console.log(` Timestamp: ${report.timestamp}`);
  console.log(` Registry Seal: ${report.registrySha256.slice(0, 16)}...`);
  console.log(` Quorum: ${report.healthyEndpointsCount}/${report.productionEndpointsCount} (${report.fleetQuorumPercentage}%) | Avg Latency: ${report.averageLatencyMs}ms`);
  console.log("----------------------------------------------------------------------");

  for (const p of report.projects) {
    const authBadge = `[${p.authorization}]`.padEnd(32);
    console.log(`• ${p.id.padEnd(30)} ${authBadge}`);
    console.log(`  ↳ Local: ${p.resolvedLocalDir} | Archetype: ${p.type}`);
    if (p.productionUrl) {
      const probeInfo = p.probe
        ? ` -> ${p.probe.reachable ? "ONLINE" : "OFFLINE"} (HTTP ${p.probe.statusCode || "N/A"} in ${p.probe.latencyMs}ms)`
        : "";
      console.log(`  ↳ URL: ${p.productionUrl}${probeInfo}`);
    }
  }

  console.log("======================================================================");
}

main().catch((err) => {
  console.error("Mission Control failed:", err);
  process.exit(1);
});
