import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";

import { EosTlcFormalChecker } from "../src/core/eosTlcFormalChecker.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-173: Dual-Mode TLC Runtime Detection & Status Reporting", () => {
  const diagnostic = EosTlcFormalChecker.detectRuntime(projectRoot);

  assert.equal(typeof diagnostic.javaInstalled, "boolean");
  assert.equal(typeof diagnostic.tlaJarPresent, "boolean");
  assert.ok(diagnostic.executionMode === "TLC_NATIVE" || diagnostic.executionMode === "FALLBACK_BOUNDED_JS");
  assert.ok(typeof diagnostic.recommendation === "string");
  assert.ok(diagnostic.recommendation.length > 10);
});

test("BDD-174: Formal Model Checking Execution (Nominal)", () => {
  const result = EosTlcFormalChecker.verifyModel("TlcFormalModelChecker.tla", {
    projectRoot,
    steps: 250,
  });

  assert.equal(result.specification, "TlcFormalModelChecker.tla");
  assert.equal(result.status, "PASS");
  assert.ok(result.executionMode === "TLC_NATIVE" || result.executionMode === "FALLBACK_BOUNDED_JS");
  assert.ok(result.exploredStates >= 100);
  assert.ok(result.distinctStates >= 1);
  assert.equal(result.sha256Receipt.length, 64);
  assert.ok(result.receiptId.startsWith("tlc_rec_"));
});

test("BDD-175: Transparent Bounded JS Simulation Fallback (Fail-Safe)", () => {
  // Explicitly force fallback mode to ensure deterministic simulation behavior
  const fallbackResult = EosTlcFormalChecker.verifyModel("AgentTopologyMesh.tla", {
    projectRoot,
    steps: 300,
    forceFallback: true,
  });

  assert.equal(fallbackResult.executionMode, "FALLBACK_BOUNDED_JS");
  assert.equal(fallbackResult.status, "PASS");
  assert.equal(fallbackResult.exploredStates, 300);
  assert.ok(fallbackResult.distinctStates > 0);
  assert.equal(fallbackResult.sha256Receipt.length, 64);
  assert.ok(fallbackResult.rawOutputSummary.includes("AgentTopologyMesh"));
});

test("BDD-176: Safe Download URL and Configuration Validation", () => {
  assert.ok(EosTlcFormalChecker.OFFICIAL_TLA2TOOLS_URL.startsWith("https://"));
  assert.ok(EosTlcFormalChecker.OFFICIAL_TLA2TOOLS_URL.includes("tla2tools.jar"));
  assert.equal(typeof EosTlcFormalChecker.downloadTlaJar, "function");
});

test("BDD-177: Cryptographic Verification Receipt & Ledger Monotonic Chain", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-tlc-ledger-test-"));
  try {
    const res = EosTlcFormalChecker.verifyModel("AutonomousClosedLoopHealing.tla", {
      projectRoot,
      steps: 150,
      forceFallback: true,
    });

    assert.equal(res.status, "PASS");
    assert.equal(res.sha256Receipt.length, 64);

    const recorded = EosTlcFormalChecker.recordReceiptInLedger(res, tempDir);
    assert.equal(recorded, true);

    const ledger = new EosDurableSqliteLedger(EosDurableSqliteLedger.defaultLedgerPath(tempDir));
    try {
      const recent = ledger.listRecent(5);
      const found = recent.find((e) => e.payload && e.payload.sha256Receipt === res.sha256Receipt);

      assert.ok(found, "TLC verification receipt must be recorded in SQLite WAL ledger");
      assert.equal(found.category, "VERIFICATION_RECEIPT");
      assert.ok(found.title.includes("TLC Formal Verification"));
      assert.ok(found.title.includes("AutonomousClosedLoopHealing.tla"));
    } finally {
      ledger.close();
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Ignore cleanup error on Windows CI
    }
  }
});

test("BDD-178: MCP Dispatch of eos_tlc_checker via EosMcpServer", () => {
  const server = new EosMcpServer(projectRoot);

  // 1. Check tools/list contains eos_tlc_checker
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });

  assert.ok(!listRes.error);
  const toolNames = listRes.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes("eos_tlc_checker"));

  // 2. Call status action
  const statusRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_tlc_checker",
      arguments: {
        action: "status",
      },
    },
  });

  assert.ok(!statusRes.error);
  const statusData = JSON.parse(statusRes.result.content[0].text);
  assert.equal(typeof statusData.javaInstalled, "boolean");
  assert.ok(statusData.executionMode === "TLC_NATIVE" || statusData.executionMode === "FALLBACK_BOUNDED_JS");

  // 3. Call check action
  const checkRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_tlc_checker",
      arguments: {
        action: "check",
        specification: "TlcFormalModelChecker.tla",
        steps: 100,
      },
    },
  });

  assert.ok(!checkRes.error);
  const checkData = JSON.parse(checkRes.result.content[0].text);
  assert.equal(checkData.status, "PASS");
  assert.equal(checkData.specification, "TlcFormalModelChecker.tla");
  assert.equal(checkData.sha256Receipt.length, 64);
});

test("BDD-179: Deep Branch Coverage for TLC Native, Jar Location, Downloads, and Invariants", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-tlc-branches-"));
  try {
    // 1. Candidate paths with mock jar
    const mockJar = path.join(tmpDir, "tla2tools.jar");
    fs.writeFileSync(mockJar, "dummy jar content", "utf8");
    process.env.TLA2TOOLS_JAR_PATH = mockJar;

    const diagWithJar = EosTlcFormalChecker.detectRuntime(projectRoot);
    assert.equal(diagWithJar.tlaJarPresent, true);
    assert.equal(diagWithJar.tlaJarPath, path.resolve(mockJar));

    // 2. Mock downloadTlaJar with redirect, 200 stream, 404 error, and network error
    const origGet = https.get;
    try {
      // 2a. Successful download with 302 redirect
      let callCount = 0;
      https.get = (urlStr, cb) => {
        const req = new EventEmitter();
        process.nextTick(() => {
          if (callCount === 0) {
            callCount++;
            // 302 redirect
            cb({
              statusCode: 302,
              headers: { location: "https://redirect.example.com/tla2tools.jar" },
            });
          } else {
            // 200 OK
            const res = new EventEmitter();
            res.statusCode = 200;
            res.pipe = (dest) => {
              dest.write(Buffer.from("PK-fake-jar"));
              dest.end();
            };
            cb(res);
            res.emit("data", Buffer.from("PK-fake-jar"));
          }
        });
        return req;
      };

      const downloadResult = await EosTlcFormalChecker.downloadTlaJar(path.join(tmpDir, "dl"));
      assert.equal(downloadResult.success, true);
      assert.ok(downloadResult.bytesDownloaded > 0);

      // 2b. 404 HTTP error
      https.get = (urlStr, cb) => {
        const req = new EventEmitter();
        process.nextTick(() => {
          cb({ statusCode: 404 });
        });
        return req;
      };
      await assert.rejects(() => EosTlcFormalChecker.downloadTlaJar(path.join(tmpDir, "dl_fail")), /HTTP 404/);

      // 2c. Network error
      https.get = () => {
        const req = new EventEmitter();
        process.nextTick(() => {
          req.emit("error", new Error("DNS resolution failed"));
        });
        return req;
      };
      await assert.rejects(
        () => EosTlcFormalChecker.downloadTlaJar(path.join(tmpDir, "dl_fail_net")),
        /DNS resolution failed/,
      );
    } finally {
      https.get = origGet;
    }

    // 3. recordReceiptInLedger failure with circular payload
    const circular = { x: 1 };
    circular.self = circular;
    const badReceipt = {
      specification: "Mock.tla",
      status: "PASS",
      executionMode: "FALLBACK_BOUNDED_JS",
      exploredStates: 10,
      distinctStates: 5,
      transitionsCalculated: 10,
      durationMs: 1,
      sha256Receipt: "0".repeat(64),
      receiptId: circular,
      timestampIso: new Date().toISOString(),
    };
    const recFail = EosTlcFormalChecker.recordReceiptInLedger(badReceipt, ":memory:");
    assert.equal(recFail, false);
  } finally {
    delete process.env.TLA2TOOLS_JAR_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
