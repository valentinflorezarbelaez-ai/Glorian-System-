import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosNocturnalEvolutionEngine } from "../src/core/eosNocturnalEvolutionEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("BDD-350: EosNocturnalEvolutionEngine executes evolution sweep and computes AlphaEvolve fitness", () => {
  const engine = new EosNocturnalEvolutionEngine(root);
  const report = engine.runEvolutionSweep({ targetDir: "src/core" });

  assert.equal(report.status, "EVOLUTION_CYCLE_COMPLETED");
  assert.ok(report.scannedFilesCount >= 50, `Expected at least 50 files, got ${report.scannedFilesCount}`);
  assert.ok(report.totalLinesAnalyzed > 10000, `Expected >10,000 lines, got ${report.totalLinesAnalyzed}`);
  assert.ok(report.compositeFitnessScore >= 50 && report.compositeFitnessScore <= 100, `Fitness score out of bounds: ${report.compositeFitnessScore}`);
  assert.ok(report.sha256Receipt.length === 64, "Expected valid 64-character SHA-256 seal");
  assert.ok(report.durationMs >= 0);
});

test("BDD-351: formatNocturnalSummary formats high-density terminal dashboard", () => {
  const engine = new EosNocturnalEvolutionEngine(root);
  const report = engine.runEvolutionSweep({ targetDir: "src/core" });
  const summary = EosNocturnalEvolutionEngine.formatNocturnalSummary(report);

  assert.ok(summary.includes("GLORIAN NOCTURNAL DARWINIAN EVOLUTION"));
  assert.ok(summary.includes("AlphaEvolve Fitness Score:"));
  assert.ok(summary.includes("AUDIT TELEMETRY & CODE DIET METRICS:"));
  assert.ok(summary.includes("Total Source Files Analyzed"));
  assert.ok(summary.includes("NOCTURNAL SWEEP COMPLETE"));
});

test("BDD-352: EosMcpServer dispatches eos_nocturnal_evolution for both json and summary formats", () => {
  const server = new EosMcpServer(root);

  // 1. JSON format
  const jsonRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 995,
    method: "tools/call",
    params: {
      name: "eos_nocturnal_evolution",
      arguments: {
        targetDir: "src/core",
        format: "json"
      }
    }
  });

  assert.ok(jsonRes?.result?.content?.[0]?.text);
  const jsonParsed = JSON.parse(jsonRes.result.content[0].text);
  assert.equal(jsonParsed.status, "EVOLUTION_CYCLE_COMPLETED");
  assert.ok(jsonParsed.compositeFitnessScore >= 50);

  // 2. Summary format
  const sumRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 996,
    method: "tools/call",
    params: {
      name: "eos_nocturnal_evolution",
      arguments: {
        targetDir: "src/core",
        format: "summary"
      }
    }
  });

  assert.ok(sumRes?.result?.content?.[0]?.text);
  const sumParsed = JSON.parse(sumRes.result.content[0].text);
  assert.ok(sumParsed.summary.includes("GLORIAN NOCTURNAL DARWINIAN EVOLUTION"));
  assert.ok(sumParsed.compositeFitnessScore >= 50);
});
