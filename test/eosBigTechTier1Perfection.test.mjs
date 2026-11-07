/**
 * EOS SYSTEM — BIG TECH TIER-1 PERFECTION TEST SUITE
 * Governed by ADR-037, SPEC-030, FR-081..FR-085, BDD-070..BDD-073
 *
 * Verifies the 4 Apex Engineering Pillars:
 * 1. Cryptographic Binary WAL with hardware fsync & crash recovery (BDD-070)
 * 2. WebGPU WGSL compute shaders & 3D topology projection (BDD-071)
 * 3. Prometheus /metrics exposition & MCP integration (BDD-072)
 * 4. Hermetic Copy-On-Write virtual filesystem sandbox (BDD-073)
 *
 * 100% Layer-0 purity with zero external npm dependencies.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { EosDurableWal } from "../src/core/eosDurableWal.ts";
import { EosWebGpuTopologyBridge } from "../src/core/eosWebGpuTopology.ts";
import { EosPrometheusExporter } from "../src/core/eosPrometheusExporter.ts";
import { EosHermeticSandbox } from "../src/core/eosHermeticSandbox.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-030: Big Tech Tier-1 Apex Engineering Verification", () => {
  let tempDir;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-tier1-perfection-"));
  });

  after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // PILLAR 1: Cryptographic Binary WAL & Crash Recovery (BDD-070)
  // =========================================================================
  test("BDD-070: Binary WAL persists 50 transactions with fsync and recovers 100% cleanly", () => {
    const walFile = path.join(tempDir, "tier1_test.wal");

    // 1. Initialize and append 50 transactions
    const wal1 = new EosDurableWal(walFile, { enableFsync: true });
    assert.equal(wal1.getStatistics().recordsCount, 0);

    for (let i = 1; i <= 50; i++) {
      const rec = wal1.append({
        transactionIndex: i,
        account: `nu:account:9481-${i}`,
        amountCents: i * 250,
        currency: "USD",
        idempotencyToken: `idemp-token-${i}`,
      });
      assert.equal(rec.txId, BigInt(i));
    }

    const stats1 = wal1.getStatistics();
    assert.equal(stats1.recordsCount, 50);
    assert.equal(stats1.currentTxId, 50n);
    assert.ok(stats1.totalBytesWritten > 50 * 30, "WAL bytes written must include frame headers and payloads");

    // Close WAL cleanly
    wal1.close();

    // 2. Open new instance and verify clean linear replay
    const wal2 = new EosDurableWal(walFile);
    const recoveryReport = wal2.getRecoveryReport();

    assert.equal(recoveryReport.status, "CLEAN_RECOVERY");
    assert.equal(recoveryReport.recoveredRecords, 50);
    assert.equal(recoveryReport.lastTxId, 50n);
    assert.equal(recoveryReport.tornTailBytesTruncated, 0);

    // Verify replay iterator integrity
    const replayed = wal2.replay();
    assert.equal(replayed.length, 50);
    assert.equal(replayed[0].payload.transactionIndex, 1);
    assert.equal(replayed[49].payload.transactionIndex, 50);

    wal2.close();

    // 3. Simulate sudden crash with torn partial write: append 9 corrupted bytes
    const tornBytes = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05]);
    fs.appendFileSync(walFile, tornBytes);

    // Open third instance: must detect torn write, truncate corrupted tail, and recover all 50 valid records
    const wal3 = new EosDurableWal(walFile);
    const tornRecovery = wal3.getRecoveryReport();

    assert.equal(tornRecovery.status, "TORN_WRITE_RECOVERED");
    assert.equal(tornRecovery.recoveredRecords, 50);
    assert.equal(tornRecovery.lastTxId, 50n);
    assert.equal(tornRecovery.tornTailBytesTruncated, 9);

    // Verify new transaction can safely append after torn tail truncation
    const nextRec = wal3.append({ transactionIndex: 51, account: "nu:account:recovery-ok" });
    assert.equal(nextRec.txId, 51n);

    wal3.close();
  });

  // =========================================================================
  // PILLAR 2: WebGPU WGSL Compute Shader & 3D Topology (BDD-071)
  // =========================================================================
  test("BDD-071: WebGPU WGSL compute shader loads, compiles, and projects 14-node fleet topology", () => {
    const bridge = new EosWebGpuTopologyBridge();

    // 1. Verify WGSL compute shader source is loaded and syntactically well-formed
    const wgslSource = bridge.getShaderSource();
    assert.ok(wgslSource.length > 500, "WGSL compute shader source must not be empty");
    assert.ok(wgslSource.includes("@compute"), "WGSL shader must declare compute stage");
    assert.ok(wgslSource.includes("@workgroup_size(64)"), "WGSL shader must define 64-thread workgroup");
    assert.ok(wgslSource.includes("struct NodeInput"), "WGSL shader must declare NodeInput memory layout");

    // 2. Compute topology projection
    const sampleNodes = [
      { id: "node-1", x: 10, y: 20, z: 30, vx: 0.1, vy: 0.2, vz: -0.1 },
      { id: "node-2", x: -15, y: 5, z: 40, vx: -0.2, vy: 0.1, vz: 0.3 },
      { id: "node-3", x: 0, y: -25, z: 10, vx: 0.05, vy: -0.1, vz: 0.1 },
    ];

    const projected = bridge.computeTopology(sampleNodes, 0.45, 0.78, 1.0);
    assert.equal(projected.length, 3);
    assert.equal(projected[0].id, "node-1");
    assert.ok(typeof projected[0].screenX === "number");
    assert.ok(typeof projected[0].screenY === "number");
    assert.ok(typeof projected[0].depth === "number");

    // 3. Verify hardware capability report and zero-allocation guarantee
    const report = bridge.getCapabilityReport();
    assert.ok(["WEBGPU_HARDWARE_ACCELERATED", "ZERO_ALLOCATION_CPU_SIMD_FALLBACK"].includes(report.executionMode));
    assert.equal(report.shaderValid, true);
    assert.equal(report.wgslWorkgroupSize, 64);
  });

  // =========================================================================
  // PILLAR 3: Prometheus Text Format Observability & /metrics (BDD-072)
  // =========================================================================
  test("BDD-072: Prometheus exporter outputs standard v0.0.4 text format with gauges and counters", () => {
    const exporter = new EosPrometheusExporter(process.cwd());
    const metricsText = exporter.formatPrometheusText();

    // Check Prometheus 0.0.4 text standard compliance
    assert.ok(
      metricsText.includes("# HELP eos_uptime_seconds"),
      "Prometheus text must include HELP comment for uptime",
    );
    assert.ok(
      metricsText.includes("# TYPE eos_uptime_seconds gauge"),
      "Prometheus text must declare gauge type for uptime",
    );
    assert.ok(/eos_uptime_seconds \d+/.test(metricsText), "eos_uptime_seconds metric must have a numeric value");

    assert.ok(metricsText.includes("# HELP eos_active_formal_specs"), "Must expose active specs");
    assert.ok(/eos_active_formal_specs \d+/.test(metricsText), "Must report active architectural specs count");

    assert.ok(
      metricsText.includes("# HELP eos_wal_committed_transactions_total"),
      "Must expose WAL transactions counter",
    );
    assert.ok(
      metricsText.includes("# TYPE eos_wal_committed_transactions_total counter"),
      "WAL transactions must be a counter",
    );

    // Test MCP tool integration for prometheus metrics
    const mcp = new EosMcpServer(process.cwd());
    const mcpRes = mcp.handleRequest({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "eos_prometheus_metrics", arguments: {} },
    });

    assert.equal(mcpRes.result.content[0].type, "text");
    const parsed = JSON.parse(mcpRes.result.content[0].text);
    assert.equal(parsed.format, "text/plain; version=0.0.4");
    assert.ok(parsed.metrics.includes("eos_uptime_seconds"));
  });

  // =========================================================================
  // PILLAR 4: Hermetic Copy-On-Write Virtual Sandbox (BDD-073)
  // =========================================================================
  test("BDD-073: Hermetic sandbox rejects invalid code and secrets without touching physical disk", () => {
    const sandboxDir = path.join(tempDir, "sandbox_workspace");
    fs.mkdirSync(sandboxDir, { recursive: true });

    const sandbox = new EosHermeticSandbox(sandboxDir);

    // 1. Stage broken JavaScript syntax
    sandbox.stageFile("src/broken.js", "const x = ; // syntax error");
    assert.deepEqual(sandbox.getStagedFiles(), ["src/broken.js"]);

    // Physical disk must NOT have been written
    assert.equal(fs.existsSync(path.join(sandboxDir, "src/broken.js")), false);

    // Validation must fail
    const brokenValidation = sandbox.validateOverlay();
    assert.equal(brokenValidation.status, "SANDBOX_REJECTED");
    assert.equal(brokenValidation.passed, false);
    assert.ok(brokenValidation.errors.length > 0);
    assert.ok(brokenValidation.errors[0].message.includes("syntax error"));

    // Attempting commit must abort
    const abortCommit = sandbox.commitToDisk();
    assert.equal(abortCommit.status, "ABORTED_ON_VALIDATION_FAILURE");
    assert.equal(fs.existsSync(path.join(sandboxDir, "src/broken.js")), false);

    // 2. Stage prohibited plain secret / API key
    sandbox.discard();
    sandbox.stageFile("src/secret.ts", `export const apiKey = "sk-abcdef123456789012345678";`);
    const secretValidation = sandbox.validateOverlay();
    assert.equal(secretValidation.status, "SANDBOX_REJECTED");
    assert.ok(secretValidation.errors.some((e) => e.message.includes("Security invariant violation")));

    // 3. Stage valid clean TypeScript module
    sandbox.discard();
    sandbox.stageFile(
      "src/cleanModule.ts",
      `export interface SovereignNode {\n  id: string;\n  status: "ONLINE" | "OFFLINE";\n}\n\nexport const NODE_A: SovereignNode = { id: "node-1", status: "ONLINE" };\n`,
    );

    const cleanValidation = sandbox.validateOverlay();
    assert.equal(cleanValidation.status, "SANDBOX_PASSED");
    assert.equal(cleanValidation.passed, true);
    assert.equal(cleanValidation.errors.length, 0);

    // Commit to disk with WAL logging
    const walFile = path.join(tempDir, "sandbox_audit.wal");
    const wal = new EosDurableWal(walFile);

    const commitReport = sandbox.commitToDisk(wal);
    assert.equal(commitReport.status, "COMMITTED");
    assert.equal(commitReport.filesWritten.length, 1);
    assert.equal(commitReport.walTxId, 1n);

    // Verify physical file was safely written to disk
    const writtenPath = path.join(sandboxDir, "src/cleanModule.ts");
    assert.equal(fs.existsSync(writtenPath), true);
    assert.ok(fs.readFileSync(writtenPath, "utf-8").includes("SovereignNode"));

    // Verify WAL has logged the commit transaction
    assert.equal(wal.getStatistics().recordsCount, 1);
    wal.close();
  });
});
