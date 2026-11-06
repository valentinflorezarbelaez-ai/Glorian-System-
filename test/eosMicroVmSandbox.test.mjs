import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMicroVmSandbox } from "../src/core/eosMicroVmSandbox.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-185: Runtime Virtualization Engine Detection", () => {
  const diag = EosMicroVmSandbox.diagnoseHost();

  assert.ok(
    diag.tier === "FIRECRACKER" ||
    diag.tier === "DOCKER_GVISOR" ||
    diag.tier === "EPHEMERAL_NODE_VM"
  );
  assert.equal(typeof diag.dockerAvailable, "boolean");
  assert.equal(typeof diag.gVisorAvailable, "boolean");
  assert.equal(typeof diag.firecrackerAvailable, "boolean");
  assert.equal(diag.memoryLimitMb, 512);
  assert.equal(diag.timeoutLimitMs, 15000);
  assert.equal(diag.networkIsolated, true);
  assert.ok(diag.recommendation.length > 10);
});

test("BDD-186: Hermetic Isolated Execution (Nominal)", () => {
  const result = EosMicroVmSandbox.runIsolated({
    codeOrCommand: "console.log('Nominal Execution Passed'); const x = 40 + 2; assert.strictEqual(x, 42);",
    timeoutMs: 3000
  });

  assert.equal(result.status, "COMPLETED");
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("Nominal Execution Passed"));
  assert.ok(result.durationMs >= 0);
  assert.equal(result.sha256Attestation.length, 64);
  assert.ok(result.executionId.startsWith("sbx_exec_"));
});

test("BDD-187: Zero-Network Barrier Enforcement (Outbound Blocked)", () => {
  const networkAttempt = `
    const https = require('https');
    https.get('https://example.com');
  `;

  const result = EosMicroVmSandbox.runIsolated({
    codeOrCommand: networkAttempt,
    timeoutMs: 3000
  });

  assert.equal(result.status, "NETWORK_VIOLATION_BLOCKED");
  assert.notStrictEqual(result.exitCode, 0);
  assert.ok(result.stderr.includes("Zero-Network"));
  assert.equal(result.sha256Attestation.length, 64);
});

test("BDD-188: Timeout & Resource Overrun Containment (Process Kill)", () => {
  // Test infinite loop containment with a 50ms tight timeout
  const infiniteLoop = "while(true) { const a = 1; }";

  const result = EosMicroVmSandbox.runIsolated({
    codeOrCommand: infiniteLoop,
    timeoutMs: 50
  });

  assert.equal(result.status, "TIMEOUT_KILLED");
  assert.notStrictEqual(result.exitCode, 0);
  assert.ok(result.stderr.includes("timed out") || result.stderr.length > 0);
  assert.equal(result.sha256Attestation.length, 64);
});

test("BDD-189: Cryptographic Attestation & Ledger Chain Recording", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sandbox-ledger-test-"));
  try {
    const res = EosMicroVmSandbox.runIsolated({
      codeOrCommand: "console.log('Ledger Persistence Test');",
      timeoutMs: 2000
    });

    assert.equal(res.status, "COMPLETED");
    assert.equal(res.sha256Attestation.length, 64);

    const recorded = EosMicroVmSandbox.recordReceiptInLedger(res, tempDir);
    assert.equal(recorded, true);

    const ledger = new EosDurableSqliteLedger(EosDurableSqliteLedger.defaultLedgerPath(tempDir));
    try {
      const recent = ledger.listRecent(5);
      const found = recent.find(
        (e) => e.payload && e.payload.sha256Attestation === res.sha256Attestation
      );

      assert.ok(found, "Sandbox execution receipt must be recorded in SQLite WAL ledger");
      assert.equal(found.category, "MISSION_DIRECTION");
      assert.ok(found.title.includes("MicroVM Sandbox Execution"));
      assert.ok(found.title.includes(res.tierUsed));
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("BDD-190: MCP Dispatch of eos_microvm_sandbox via EosMcpServer", () => {
  const server = new EosMcpServer(projectRoot);

  // 1. Check tools/list contains eos_microvm_sandbox
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  assert.ok(!listRes.error);
  const toolNames = listRes.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes("eos_microvm_sandbox"));

  // 2. Call doctor action
  const docRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_microvm_sandbox",
      arguments: {
        action: "doctor"
      }
    }
  });

  assert.ok(!docRes.error);
  const docData = JSON.parse(docRes.result.content[0].text);
  assert.ok(docData.tier);
  assert.equal(docData.memoryLimitMb, 512);

  // 3. Call run action
  const runRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_microvm_sandbox",
      arguments: {
        action: "run",
        codeOrCommand: "console.log('MCP Sandbox Dispatch');",
        timeoutMs: 3000
      }
    }
  });

  assert.ok(!runRes.error);
  const runData = JSON.parse(runRes.result.content[0].text);
  assert.equal(runData.status, "COMPLETED");
  assert.equal(runData.exitCode, 0);
  assert.ok(runData.stdout.includes("MCP Sandbox Dispatch"));
  assert.equal(runData.sha256Attestation.length, 64);
});
