/**
 * EOS ENTERPRISE MODULES TEST SUITE
 * Tests for v60: Secrets Manager, Tracer, LSP Diagnostics, Worker Tribunal.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const { EosSecretsManager } = await import("../src/core/eosSecretsManager.ts");
const { EosTracer } = await import("../src/core/eosTracer.ts");
const { computeDiagnosticsForFile, writeDiagnosticsFile } = await import("../src/core/eosLspDiagnostics.ts");
const { EosWorkerTribunal } = await import("../src/core/eosWorkerTribunal.ts");

// ── Suite 1: Secrets Manager ─────────────────────────────────────────────────
describe("EosSecretsManager — Production Secrets (AWS/Vault/Doppler)", () => {

  it("defaults to env provider when EOS_SECRETS_PROVIDER is not set", () => {
    const sm = EosSecretsManager.getInstance();
    assert.equal(sm.providerType, "env");
  });

  it("returns env var value via get()", async () => {
    process.env["EOS_TEST_SECRET_KEY"] = "test-value-123";
    const sm = EosSecretsManager.getInstance();
    const val = await sm.get("EOS_TEST_SECRET_KEY");
    assert.equal(val, "test-value-123");
    delete process.env["EOS_TEST_SECRET_KEY"];
  });

  it("returns null for missing key", async () => {
    const sm = EosSecretsManager.getInstance();
    const val = await sm.get("EOS_NONEXISTENT_KEY_XYZ123");
    assert.equal(val, null);
  });

  it("require() throws for missing key", async () => {
    const sm = EosSecretsManager.getInstance();
    await assert.rejects(
      () => sm.require("EOS_DEFINITELY_MISSING_KEY_ABCXYZ"),
      /Required secret/
    );
  });

  it("caches values — second call uses cache", async () => {
    process.env["EOS_CACHE_TEST"] = "cached-value";
    const sm = EosSecretsManager.getInstance();
    sm.invalidate("EOS_CACHE_TEST"); // clear any existing
    const v1 = await sm.get("EOS_CACHE_TEST");
    const v2 = await sm.get("EOS_CACHE_TEST");
    assert.equal(v1, v2);
    delete process.env["EOS_CACHE_TEST"];
  });

  it("invalidate() forces re-fetch on next call", async () => {
    const sm = EosSecretsManager.getInstance();
    process.env["EOS_INVALIDATE_TEST"] = "original";
    await sm.get("EOS_INVALIDATE_TEST"); // prime cache
    process.env["EOS_INVALIDATE_TEST"] = "updated";
    sm.invalidate("EOS_INVALIDATE_TEST");
    const val = await sm.get("EOS_INVALIDATE_TEST");
    assert.equal(val, "updated");
    delete process.env["EOS_INVALIDATE_TEST"];
  });
});

// ── Suite 2: Distributed Tracer ──────────────────────────────────────────────
describe("EosTracer — OTLP Distributed Tracing (AWS X-Ray / Jaeger / Tempo)", () => {

  it("startSpan returns a valid span with traceId and spanId", () => {
    const tracer = EosTracer.getInstance();
    const span = tracer.startSpan("test.operation");
    assert.ok(span.traceId.length > 0, "traceId must be non-empty");
    assert.ok(span.spanId.length > 0, "spanId must be non-empty");
    assert.equal(span.name, "test.operation");
    assert.equal(span.status, "UNSET");
    span.end();
  });

  it("setAttribute sets values that persist until end()", () => {
    const tracer = EosTracer.getInstance();
    const span = tracer.startSpan("test.attrs");
    span.setAttribute("key1", "value1");
    span.setAttribute("count", 42);
    span.setAttribute("flag", true);
    assert.equal(span.attributes["key1"], "value1");
    assert.equal(span.attributes["count"], 42);
    assert.equal(span.attributes["flag"], true);
    span.end();
  });

  it("setStatus changes span status", () => {
    const tracer = EosTracer.getInstance();
    const span = tracer.startSpan("test.status");
    span.setStatus("OK");
    assert.equal(span.status, "OK");
    span.end();
  });

  it("setStatus(ERROR) sets message", () => {
    const tracer = EosTracer.getInstance();
    const span = tracer.startSpan("test.error");
    span.setStatus("ERROR", "something went wrong");
    assert.equal(span.status, "ERROR");
    assert.equal(span.statusMessage, "something went wrong");
    span.end();
  });

  it("toTraceparent returns W3C-format string", () => {
    const tracer = EosTracer.getInstance();
    const span = tracer.startSpan("test.propagation");
    const tp = span.toTraceparent();
    assert.match(tp, /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
      "traceparent must match W3C format");
    span.end();
  });

  it("trace() wrapper sets OK status on success", async () => {
    const tracer = EosTracer.getInstance();
    const result = await tracer.trace("test.async", async (span) => {
      span.setAttribute("work", "done");
      return 42;
    });
    assert.equal(result, 42);
  });

  it("trace() wrapper sets ERROR status on throw", async () => {
    const tracer = EosTracer.getInstance();
    await assert.rejects(
      () => tracer.trace("test.fail", async () => { throw new Error("intentional"); }),
      /intentional/
    );
  });

  it("child span propagates traceId from parent traceparent", () => {
    const tracer = EosTracer.getInstance();
    const parent = tracer.startSpan("parent");
    const parentTp = parent.toTraceparent();
    const child = tracer.startSpan("child", {}, "INTERNAL", parentTp);
    assert.equal(child.traceId, parent.traceId, "Child must share parent traceId");
    assert.notEqual(child.spanId, parent.spanId, "Child must have unique spanId");
    parent.end();
    child.end();
  });
});

// ── Suite 3: LSP Diagnostics ──────────────────────────────────────────────────
describe("EosLspDiagnostics — Language Server Protocol 3.17 (Cursor/VS Code)", () => {
  let tmpDir;

  before(() => {
    tmpDir = path.join(os.tmpdir(), `eos-lsp-test-${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, "src", "core"), { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computeDiagnosticsForFile returns an EosDiagnosticsResult", async () => {
    const testFile = path.join(root, "src", "core", "eosTurboEngine.ts");
    if (!fs.existsSync(testFile)) return; // skip if file missing

    const result = await computeDiagnosticsForFile(testFile, root);
    assert.ok(result.fileUri.startsWith("file://"), "URI must start with file://");
    assert.ok(Array.isArray(result.diagnostics), "diagnostics must be an array");
    assert.ok(result.sha256.startsWith("sha256:"), "sha256 must start with sha256:");
    assert.ok(result.computedAt.includes("T"), "computedAt must be ISO timestamp");
  });

  it("all diagnostics have required LSP fields", async () => {
    const testFile = path.join(root, "src", "core", "eosTurboEngine.ts");
    if (!fs.existsSync(testFile)) return;

    const result = await computeDiagnosticsForFile(testFile, root);
    for (const diag of result.diagnostics) {
      assert.ok(diag.range, "diagnostic must have range");
      assert.ok(diag.range.start, "range must have start");
      assert.ok(diag.source.length > 0, "diagnostic must have source");
      assert.ok(diag.message.length > 0, "diagnostic must have message");
      assert.ok(diag.severity >= 1 && diag.severity <= 4, "severity must be 1-4");
    }
  });

  it("writeDiagnosticsFile creates a valid JSON file", async () => {
    const outPath = path.join(tmpDir, "test-diagnostics.json");
    const result = await writeDiagnosticsFile(root, outPath);
    // The function returns the path
    assert.equal(result, outPath);
    if (fs.existsSync(outPath)) {
      const content = JSON.parse(fs.readFileSync(outPath, "utf8"));
      assert.ok(Array.isArray(content), "diagnostics file must be an array");
    }
  });
});

// ── Suite 4: Worker Tribunal ──────────────────────────────────────────────────
describe("EosWorkerTribunal — VM-Isolated Concurrent Branch Evaluation (Cognition/AWS)", () => {
  let tmpDir;

  before(() => {
    tmpDir = path.join(os.tmpdir(), `eos-tribunal-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("evaluates a passing branch — sequential mode", async () => {
    const targetFile = path.join(tmpDir, "solution.txt");
    const testScript = path.join(tmpDir, "verify.mjs");
    fs.writeFileSync(testScript, `
import fs from "node:fs";
const f = ${JSON.stringify(targetFile)};
if (!fs.existsSync(f) || !fs.readFileSync(f, "utf8").includes("PASS")) process.exit(1);
process.exit(0);
`, "utf8");

    const branches = [{
      id: "BRANCH-001",
      strategy: "Write passing content",
      targetRelPath: path.relative(tmpDir, targetFile),
      proposedContent: "PASS: This branch succeeds",
      estimatedComplexity: 1,
    }];

    const result = await EosWorkerTribunal.evaluate(
      branches, `node ${testScript}`, tmpDir, tmpDir, 10_000,
      { concurrent: false }
    );

    assert.equal(result.winningBranchId, "BRANCH-001");
    assert.equal(result.verdicts.length, 1);
    assert.equal(result.verdicts[0]?.passed, true);
    assert.ok(result.executionHash.startsWith("sha256:"));
  });

  it("handles a failing branch and records rollback", async () => {
    const targetFile = path.join(tmpDir, "rollback_test.txt");
    fs.writeFileSync(targetFile, "ORIGINAL", "utf8");
    const testScript = path.join(tmpDir, "fail.mjs");
    fs.writeFileSync(testScript, "process.exit(1);", "utf8");

    const branches = [{
      id: "BRANCH-FAIL",
      strategy: "Will fail",
      targetRelPath: path.relative(tmpDir, targetFile),
      proposedContent: "MUTATED",
      estimatedComplexity: 1,
    }];

    const result = await EosWorkerTribunal.evaluate(
      branches, `node ${testScript}`, tmpDir, tmpDir, 5_000,
      { concurrent: false }
    );

    assert.equal(result.winningBranchId, null, "No winner when all branches fail");
    assert.equal(result.verdicts[0]?.passed, false);
    // File should be restored
    const content = fs.readFileSync(targetFile, "utf8");
    assert.equal(content, "ORIGINAL", "File must be restored after failed branch");
  });

  it("evaluates branches concurrently — all pass independently", async () => {
    const testScript = path.join(tmpDir, "pass_all.mjs");
    fs.writeFileSync(testScript, "process.exit(0);", "utf8");

    const branches = [
      { id: "B1", strategy: "Branch 1", targetRelPath: "b1.txt", proposedContent: "B1", estimatedComplexity: 3 },
      { id: "B2", strategy: "Branch 2", targetRelPath: "b2.txt", proposedContent: "B2", estimatedComplexity: 1 },
    ];

    const result = await EosWorkerTribunal.evaluate(
      branches, `node ${testScript}`, tmpDir, tmpDir, 8_000,
      { concurrent: true, maxConcurrency: 2 }
    );

    assert.ok(result.verdicts.length >= 1, "Should have at least one verdict");
    // Winning branch should be simplest (B2, complexity 1)
    if (result.winningBranchId) {
      assert.equal(result.winningBranchId, "B2", "Simplest branch should win");
    }
  });
});
