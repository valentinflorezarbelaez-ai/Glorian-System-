/**
 * EOS SYSTEM — TIER-ZERO TRANSCENDENTAL APEX PERFECTION TEST SUITE
 * Governed by ADR-038, SPEC-031, FR-086..FR-089, BDD-074..BDD-077
 *
 * Verifies:
 * 1. Nanosecond statistical latency profiling (p50..p99.99) (BDD-074)
 * 2. 24/7 Sovereign Sentinel Daemon heartbeat pulse & FDIR graph health (BDD-075)
 * 3. Samaelian alchemical entropy reduction & Nous purity certification (BDD-076)
 * 4. Multi-channel CLI & MCP sovereign tools dispatching (BDD-077)
 *
 * 100% Layer-0 purity with zero external npm dependencies.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EosNanoBenchmarkEngine } from "../src/core/eosNanoBenchmarkEngine.ts";
import { EosSentinelDaemon } from "../src/core/eosSentinelDaemon.ts";
import { EosAlchemicalTransmuter } from "../src/core/eosAlchemicalTransmuter.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-031: Tier-Zero Transcendental Apex Perfection Verification", () => {
  // =========================================================================
  // PILLAR 1: Nanosecond Statistical Latency Profiler (BDD-074)
  // =========================================================================
  test("BDD-074: EosNanoBenchmarkEngine computes p50, p90, p99, p99.99 and variance in nanoseconds", () => {
    let dummyAccum = 0;
    const report = EosNanoBenchmarkEngine.runBenchmark(
      "Test Constant Math Operation",
      () => {
        dummyAccum = (dummyAccum + 42) & 0xffffff;
      },
      { iterations: 2000, warmupIterations: 200 },
    );

    assert.equal(report.name, "Test Constant Math Operation");
    assert.equal(report.iterations, 2000);
    assert.ok(report.totalDurationMs >= 0, "Duration must be non-negative");
    assert.ok(report.meanNs > 0, "Mean nanoseconds must be greater than zero");
    assert.ok(report.varianceNs >= 0, "Variance must be non-negative");
    assert.ok(report.stdDevNs >= 0, "Standard deviation must be non-negative");

    // Percentiles hierarchy invariant
    const p = report.percentilesNs;
    assert.ok(p.min <= p.p50, "min <= p50");
    assert.ok(p.p50 <= p.p90, "p50 <= p90");
    assert.ok(p.p90 <= p.p95, "p90 <= p95");
    assert.ok(p.p95 <= p.p99, "p95 <= p99");
    assert.ok(p.p99 <= p.p99_9, "p99 <= p99.9");
    assert.ok(p.p99_9 <= p.p99_99, "p99.9 <= p99.99");
    assert.ok(p.p99_99 <= p.max, "p99.99 <= max");

    // Absolute throughput is host-load dependent (the sampling loop runs inside a
    // shared CI worker), so this is a generous sanity floor proving the engine
    // completes at all; the statistical invariants above carry the real signal.
    assert.ok(report.opsPerSec > 1_000, `Ops/sec sanity floor: got ${report.opsPerSec}`);
    assert.equal(report.zeroAllocationVerified, true);
  });

  // =========================================================================
  // PILLAR 2: 24/7 Sovereign Sentinel Daemon (BDD-075)
  // =========================================================================
  test("BDD-075: EosSentinelDaemon produces healthy heartbeat tick and verifies control plane Merkle root", () => {
    const sentinel = new EosSentinelDaemon(process.cwd());
    const tick = sentinel.tick();

    assert.equal(tick.status, "SENTINEL_PULSE_HEALTHY");
    assert.ok(tick.uptimeSeconds >= 0);
    assert.equal(typeof tick.merkleRootHash, "string");
    assert.equal(tick.merkleRootHash.length, 64, "SHA-256 Merkle root must be 64 hex characters");
    assert.ok(tick.filesMonitoredCount >= 4, "Must monitor critical governance and core files");

    // Memory Health
    assert.equal(tick.memoryHealth.status, "HEALTHY");
    assert.ok(tick.memoryHealth.utilizationRatio <= 0.9, "Memory utilization must be below 90%");

    // Fleet Health
    assert.equal(tick.fleetHealth.totalNodes, 14, "Must monitor 14 sovereign fleet nodes");
    assert.deepEqual(tick.fleetHealth.ringsActive, [1, 2, 3], "Must have active nodes on rings 1, 2, 3");
    assert.equal(tick.fleetHealth.orphanLinksDetected, 0, "Zero orphan links allowed");
    assert.equal(tick.anomaliesDetected.length, 0);

    // Test start and stop background lifecycle
    sentinel.startDaemon(100000);
    assert.equal(sentinel.isDaemonRunning(), true);
    sentinel.stopDaemon();
    assert.equal(sentinel.isDaemonRunning(), false);
  });

  // =========================================================================
  // PILLAR 3: Samaelian Alchemical Entropy & Nous Purity (BDD-076)
  // =========================================================================
  test("BDD-076: EosAlchemicalTransmuter measures Shannon entropy and certifies Nous state", () => {
    const transmuter = new EosAlchemicalTransmuter(process.cwd());

    // 1. Analyze high-purity core file
    const report = transmuter.analyzeFile("src/core/eosJarvisSoul.ts");

    assert.equal(report.target, "src/core/eosJarvisSoul.ts");
    assert.ok(report.charCount > 1000);
    assert.ok(
      report.shannonEntropyBits >= 3.5 && report.shannonEntropyBits <= 5.8,
      "Source code entropy must be in natural range",
    );
    assert.ok(report.nousPurityPercent >= 90, "Core soul module must have >= 90% Nous purity");
    assert.ok(["SI", "DO_SUPERIOR"].includes(report.octaveVibrationalNote));
    assert.equal(report.agregadosDetectedCount, 0, "Zero external dependencies or secrets allowed");

    // 2. Test impure content detection (simulated agregados)
    const impureSnippet = `import axios from "axios";\nconst apiKey = "sk-123456789012345678901234";\n// TODO: fix this hack later\n`;
    const impureReport = transmuter.analyzeContent(impureSnippet, "impure.ts");
    assert.ok(impureReport.agregadosDetectedCount >= 2, "Must detect external npm import and hardcoded secret");
    assert.ok(impureReport.nousPurityPercent < 80);
    assert.ok(impureReport.transmutationAdvice.includes("Muerte Mística"));

    // 3. Test branch density penalty and all octave vibrational notes
    const highBranchDense = `if (a) { if (b) { if (c) { if (d) { if (e) { if (f) { if (g) {} } } } } } }`;
    const denseReport = transmuter.analyzeContent(highBranchDense, "dense.ts");
    assert.ok(denseReport.cyclomaticDensity > 0);

    // Test non-existent file error
    assert.throws(
      () => transmuter.analyzeFile("non/existent/path/for/sure.ts"),
      /File not found for alchemical analysis/,
    );

    // Test across octave bands by synthesizing content with controlled purity
    // DO_SUPERIOR: pure code (score 100)
    const r100 = transmuter.analyzeContent("// Pure math and algorithms\nconst phi = 1.618033988749895;\n", "pure.ts");
    assert.equal(r100.octaveVibrationalNote, "DO_SUPERIOR");

    // SI: score 90-97 (0 agregados but branch penalty ~6)
    // 1000 chars with 31 branches -> densityRatio 31 -> penalty 6 -> score 94 -> SI
    const branchPadding = "if (x) {} ".repeat(31) + " ".repeat(700);
    const rSi = transmuter.analyzeContent(branchPadding, "si.ts");
    assert.ok(rSi.nousPurityPercent >= 90 && rSi.nousPurityPercent < 98);
    assert.equal(rSi.octaveVibrationalNote, "SI");

    // LA: score 80-89 (1 agregado of TODO = -20, plus entropy bonus +5 = 85)
    const rLa = transmuter.analyzeContent(
      "// TODO: clean this\nconst x = 1234567890;\nconst y = 9876543210;\n",
      "la.ts",
    );
    assert.ok(rLa.nousPurityPercent >= 80 && rLa.nousPurityPercent < 90);
    assert.equal(rLa.octaveVibrationalNote, "LA");

    // SOL: score 70-79 (1 agregado -20 and 5 branch penalty = 75)
    const rSol = transmuter.analyzeContent("// TODO: fix\n" + "if (a) {} ".repeat(30) + " ".repeat(700), "sol.ts");
    assert.equal(rSol.nousPurityPercent, 75);
    assert.equal(rSol.octaveVibrationalNote, "SOL");

    // FA: score 60-69 (1 agregado -20 and 11 branch penalty = 69)
    const rFa = transmuter.analyzeContent("// TODO: fix\n" + "if (a) {} ".repeat(35) + " ".repeat(600), "fa.ts");
    assert.equal(rFa.nousPurityPercent, 69);
    assert.equal(rFa.octaveVibrationalNote, "FA");

    // MI: score 45-59 (2 agregados = -40 and 10 branch penalty = 50)
    const rMi = transmuter.analyzeContent(
      `// TODO: fix\nimport pkg from "ext-pkg";\n` + "if (a) {} ".repeat(35) + " ".repeat(600),
      "mi.ts",
    );
    assert.ok(rMi.nousPurityPercent >= 45 && rMi.nousPurityPercent < 60);
    assert.equal(rMi.octaveVibrationalNote, "MI");

    // RE: score 25-44 (3 agregados = -60 without bonus = 40)
    const rRe = transmuter.analyzeContent(
      `// TODO: fix\nimport pkg from "ext-pkg";\nconst apiKey = "sk-123456789012345678901234";\n` + "a".repeat(200),
      "re.ts",
    );
    assert.ok(rRe.nousPurityPercent >= 25 && rRe.nousPurityPercent < 45);
    assert.equal(rRe.octaveVibrationalNote, "RE");

    // DO: score < 25 (4 agregados = -80 without bonus = 20)
    const rDo = transmuter.analyzeContent(
      `// TODO: fix\nimport pkg1 from "ext-pkg1";\nimport pkg2 from "ext-pkg2";\nconst apiKey = "sk-123456789012345678901234";\n` +
        "a".repeat(200),
      "do.ts",
    );
    assert.ok(rDo.nousPurityPercent < 25);
    assert.equal(rDo.octaveVibrationalNote, "DO");
  });

  // =========================================================================
  // PILLAR 4: Multi-Channel CLI & MCP Tool Dispatching (BDD-077)
  // =========================================================================
  test("BDD-077: EosMcpServer dispatches Tier-0 tools (eos_nano_benchmark, eos_sentinel_tick, eos_alchemical_transmute)", () => {
    const mcp = new EosMcpServer(process.cwd());

    // 1. eos_nano_benchmark
    const nanoRes = mcp.handleRequest({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "eos_nano_benchmark", arguments: { iterations: 1000 } },
    });
    assert.equal(nanoRes.id, 101);
    const nanoData = JSON.parse(nanoRes.result.content[0].text);
    assert.equal(nanoData.iterations, 1000);
    assert.ok(nanoData.percentilesNs.p50 > 0);

    // 2. eos_sentinel_tick
    const sentinelRes = mcp.handleRequest({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "eos_sentinel_tick", arguments: {} },
    });
    assert.equal(sentinelRes.id, 102);
    const sentinelData = JSON.parse(sentinelRes.result.content[0].text);
    assert.equal(sentinelData.status, "SENTINEL_PULSE_HEALTHY");

    // 3. eos_alchemical_transmute
    const alchemRes = mcp.handleRequest({
      jsonrpc: "2.0",
      id: 103,
      method: "tools/call",
      params: { name: "eos_alchemical_transmute", arguments: { relPath: "src/core/eosJarvisSoul.ts" } },
    });
    assert.equal(alchemRes.id, 103);
    const alchemData = JSON.parse(alchemRes.result.content[0].text);
    assert.ok(alchemData.nousPurityPercent >= 90);
  });
});
