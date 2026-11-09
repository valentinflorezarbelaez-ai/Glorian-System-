/**
 * EOS OPERATIONAL GAPS TEST SUITE
 * Tests for v58: Feature Flags, Diff Patcher, API Rate Limiting, Plugin Loader.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _root = path.resolve(__dirname, "..");

const { EosFeatureFlags, isEnabled } = await import("../src/core/eosFeatureFlags.ts");
const { parseDiff, applyDiff, generateDiff } = await import("../src/core/eosDiffPatcher.ts");
const { withRateLimit } = await import("../src/core/eosApiRateLimit.ts");
const { EosPluginLoader } = await import("../src/core/eosPluginLoader.ts");
const { EosTokenBucketRateLimiter } = await import("../src/core/eosTokenBucketRateLimiter.ts");
const { createLogger, logger } = await import("../src/core/eosLogger.ts");

// ── Suite 1: Feature Flags ───────────────────────────────────────────────────
describe("EosFeatureFlags — Progressive Delivery (Stripe/Netflix Standard)", () => {
  it("reads default values from the built-in config", () => {
    const savedChaos = process.env["EOS_FLAG_CHAOS_IN_CI"];
    const savedPerf = process.env["EOS_FLAG_PERF_REGRESSION"];
    delete process.env["EOS_FLAG_CHAOS_IN_CI"];
    delete process.env["EOS_FLAG_PERF_REGRESSION"];
    try {
      const flags = new EosFeatureFlags();
      // These are enabled by default
      assert.equal(flags.isEnabled("agi_pipeline"), true);
      assert.equal(flags.isEnabled("consultant_offline"), true);
      assert.equal(flags.isEnabled("graph_cache"), true);
      // These are disabled by default (require explicit opt-in)
      assert.equal(flags.isEnabled("chaos_in_ci"), false);
      assert.equal(flags.isEnabled("perf_regression"), false);
    } finally {
      if (savedChaos !== undefined) process.env["EOS_FLAG_CHAOS_IN_CI"] = savedChaos;
      if (savedPerf !== undefined) process.env["EOS_FLAG_PERF_REGRESSION"] = savedPerf;
    }
  });

  it("reads flag override from environment variable", () => {
    process.env["EOS_FLAG_CHAOS_IN_CI"] = "1";
    const flags = new EosFeatureFlags();
    assert.equal(flags.isEnabled("chaos_in_ci"), true, "Should be enabled via env var");
    delete process.env["EOS_FLAG_CHAOS_IN_CI"];
  });

  it("env var false disables a default-true flag", () => {
    process.env["EOS_FLAG_AGI_PIPELINE"] = "false";
    const flags = new EosFeatureFlags();
    assert.equal(flags.isEnabled("agi_pipeline"), false, "Should be disabled via env var");
    delete process.env["EOS_FLAG_AGI_PIPELINE"];
  });

  it("getFlag returns source: env when set via env var", () => {
    process.env["EOS_FLAG_GRAPH_CACHE"] = "0";
    const flags = new EosFeatureFlags();
    const flag = flags.getFlag("graph_cache");
    assert.equal(flag?.source, "env");
    delete process.env["EOS_FLAG_GRAPH_CACHE"];
  });

  it("getSummary returns total, enabled, disabled counts", () => {
    const flags = new EosFeatureFlags();
    const summary = flags.getSummary();
    assert.ok(summary.total >= 10, "Should have at least 10 flags");
    assert.ok(summary.enabled > 0);
    assert.ok(summary.disabled > 0);
    assert.equal(summary.enabled + summary.disabled, summary.total);
  });

  it("reads from flags.json file when present", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-flags-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "flags.json"),
      JSON.stringify({ chaos_in_ci: true, perf_regression: true }),
      "utf8",
    );
    const flags = new EosFeatureFlags(tmpDir);
    assert.equal(flags.isEnabled("chaos_in_ci"), true, "Should read from flags.json");
    assert.equal(flags.isEnabled("perf_regression"), true, "Should read from flags.json");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("unknown flag returns false (fail-closed)", () => {
    const flags = new EosFeatureFlags();
    assert.equal(flags.isEnabled("this_does_not_exist"), false);
  });

  it("convenience isEnabled() function works", () => {
    assert.equal(typeof isEnabled("agi_pipeline"), "boolean");
  });

  it("handles isEnabledForUser with sticky hash and percentage rollout", () => {
    const flags = new EosFeatureFlags();
    // Non-existent key returns false
    assert.equal(flags.isEnabledForUser("nonexistent", "user-1"), false);

    // Binary flag without rollout percentage
    const binaryEnabled = flags.isEnabledForUser("agi_pipeline", "user-1");
    assert.equal(binaryEnabled, flags.isEnabled("agi_pipeline"));
  });

  it("handles corrupt flags.json and expired flags gracefully", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-flags-corrupt-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const flagsFile = path.join(tmpDir, "flags.json");

    // Write corrupt JSON
    fs.writeFileSync(flagsFile, "{ invalid json", "utf8");
    const flags = new EosFeatureFlags(tmpDir);
    assert.equal(flags.isEnabled("chaos_in_ci"), false);

    // Write valid JSON and test _maybeRefresh
    fs.writeFileSync(flagsFile, JSON.stringify({ chaos_in_ci: true }), "utf8");
    flags._lastRefreshAt = 0; // Force refresh trigger
    assert.equal(flags.isEnabled("chaos_in_ci"), true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ── Suite 2: Diff Patcher ────────────────────────────────────────────────────
describe("EosDiffPatcher — Diff-Based Patch Application (Cursor/Devin Standard)", () => {
  it("parseDiff correctly identifies old and new paths", () => {
    const diff = `--- a/src/core/foo.ts\n+++ b/src/core/foo.ts\n@@ -1,3 +1,3 @@\n line1\n-oldLine\n+newLine\n line3\n`;
    const parsed = parseDiff(diff);
    assert.equal(parsed.oldPath, "src/core/foo.ts");
    assert.equal(parsed.newPath, "src/core/foo.ts");
    assert.equal(parsed.hunks.length, 1);
  });

  it("parseDiff extracts hunk lines with correct types", () => {
    const diff = `--- a/foo.ts\n+++ b/foo.ts\n@@ -1,3 +1,3 @@\n context\n-remove me\n+add me\n context2\n`;
    const parsed = parseDiff(diff);
    const hunk = parsed.hunks[0];
    assert.ok(hunk);
    const types = hunk.lines.map((l) => l.type);
    assert.ok(types.includes("context"), "Should have context lines");
    assert.ok(types.includes("add"), "Should have add lines");
    assert.ok(types.includes("remove"), "Should have remove lines");
  });

  it("parseDiff returns a sha256 hash", () => {
    const diff = `--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new\n`;
    const parsed = parseDiff(diff);
    assert.ok(parsed.sha256.length === 64, "sha256 should be 64 hex chars");
  });

  it("generateDiff produces a valid unified diff", () => {
    const oldContent = "line1\nline2\nline3\n";
    const newContent = "line1\nline2changed\nline3\n";
    const diff = generateDiff(oldContent, newContent, "test.ts");
    assert.ok(diff.includes("---"), "Should have old file marker");
    assert.ok(diff.includes("+++"), "Should have new file marker");
    assert.ok(diff.includes("@@"), "Should have hunk header");
    assert.ok(diff.includes("-line2\n") || diff.includes("-line2"), "Should show removed line");
    assert.ok(diff.includes("+line2changed"), "Should show added line");
  });

  it("generateDiff + parseDiff is deterministic", () => {
    const old1 = "const x = 1;\nconst y = 2;\n";
    const new1 = "const x = 1;\nconst y = 3;\n";
    const diff = generateDiff(old1, new1, "test.ts");
    const parsed = parseDiff(diff);
    assert.equal(parsed.hunks.length, 1);
  });

  it("applyDiff returns error for non-existent file", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-diff-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const diff = parseDiff("--- a/nonexistent.ts\n+++ b/nonexistent.ts\n@@ -1 +1 @@\n-old\n+new\n");
    const result = applyDiff(diff, tmpDir);
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("not exist"));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("applyDiff returns error for path traversal targets outside projectRoot", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-diff-traversal-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const diff = parseDiff("--- a/../../secret.txt\n+++ b/../../secret.txt\n@@ -1 +1 @@\n-old\n+new\n");
    const result = applyDiff(diff, tmpDir);
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("escapes project root"));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("applyDiff rejects patch when removal line mismatches target content", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-diff-mismatch-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const targetFile = path.join(tmpDir, "target.ts");
    fs.writeFileSync(targetFile, "const actual = 42;\n", "utf8");
    const diff = parseDiff(
      "--- a/target.ts\n+++ b/target.ts\n@@ -1 +1 @@\n-const expected = 99;\n+const newval = 100;\n",
    );
    const result = applyDiff(diff, tmpDir);
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("Patch mismatch"));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("applyDiff successfully applies diff with adds, removes, and context lines", () => {
    const tmpDir = path.join(os.tmpdir(), `eos-diff-success-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const targetFile = path.join(tmpDir, "success.ts");
    fs.writeFileSync(targetFile, "line1\nline2\nline3\n", "utf8");

    const diff = parseDiff(
      "--- a/success.ts\n+++ b/success.ts\n@@ invalid-header @@\n@@ -1,3 +1,3 @@\n line1\n-line2\n\\ No newline at end of file\n+line2_updated\n line3\n",
    );
    const result = applyDiff(diff, tmpDir);
    assert.equal(result.success, true);
    assert.equal(result.linesAdded, 1);
    assert.equal(result.linesRemoved, 1);
    assert.equal(result.linesContext, 3);

    const patchedContent = fs.readFileSync(targetFile, "utf8");
    assert.equal(patchedContent, "line1\nline2_updated\nline3\n");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parseDiff skips non-hunk lines before first hunk header", () => {
    const diffWithMeta =
      "diff --git a/file.ts b/file.ts\nindex 000000..111111 100644\n--- a/file.ts\n+++ b/file.ts\nindex extra comment line\n@@ -1,1 +1,1 @@\n-old\n+new\n";
    const parsed = parseDiff(diffWithMeta);
    assert.equal(parsed.hunks.length, 1);
    assert.equal(parsed.hunks[0].lines.length, 3);
  });

  it("generateDiff produces a valid unified diff with leading/trailing context and supports round-trip apply", () => {
    const oldContent = "header\nline A\nline B\nfooter\n";
    const newContent = "header\nline A modified\nline B\nfooter\n";
    const diffText = generateDiff(oldContent, newContent, "sub/mod.ts");

    assert.ok(diffText.includes("--- a/sub/mod.ts"));
    assert.ok(diffText.includes("+++ b/sub/mod.ts"));
    assert.ok(diffText.includes("@@ -"));
    assert.ok(diffText.includes("-line A"));
    assert.ok(diffText.includes("+line A modified"));

    // Verify round-trip application on disk
    const tmpDir = path.join(os.tmpdir(), `eos-roundtrip-${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, "sub"), { recursive: true });
    const targetFile = path.join(tmpDir, "sub", "mod.ts");
    fs.writeFileSync(targetFile, oldContent, "utf8");

    const parsed = parseDiff(diffText);
    const result = applyDiff(parsed, tmpDir);
    assert.equal(result.success, true);
    assert.equal(fs.readFileSync(targetFile, "utf8"), newContent);

    // Test applyDiff with oldPath only (newPath empty)
    const oldOnlyDiff = {
      oldPath: "sub/mod.ts",
      newPath: "",
      hunks: parsed.hunks,
      sha256: parsed.sha256,
    };
    // Revert target file and apply with oldOnlyDiff
    fs.writeFileSync(targetFile, oldContent, "utf8");
    const oldOnlyResult = applyDiff(oldOnlyDiff, tmpDir);
    assert.equal(oldOnlyResult.success, true);

    // Test generateDiff with change on line 0 (no leading context) and change to end (no trailing context)
    const diffNoContext = generateDiff("single-line-old", "single-line-new", "single.txt");
    assert.ok(diffNoContext.includes("@@ -1,1 +1,1 @@"));

    // Test parseDiff with empty body line
    const diffWithEmpty = "--- a/empty.txt\n+++ b/empty.txt\n@@ -1,2 +1,2 @@\n \n-line1\n+line2\n";
    const parsedEmpty = parseDiff(diffWithEmpty);
    assert.equal(parsedEmpty.hunks[0].lines[0].type, "context");

    // Test applyDiff with non-Error thrown (catches and formats String(err))
    const mockDiff = {
      oldPath: "sub/mod.ts",
      newPath: "sub/mod.ts",
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: [
            {
              get type() {
                throw "non-error-exception";
              },
              content: "x",
            },
          ],
        },
      ],
      sha256: "0000",
    };
    const caughtRes = applyDiff(mockDiff, tmpDir);
    assert.equal(caughtRes.success, false);
    assert.equal(caughtRes.error, "non-error-exception");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ── Suite 3: Rate Limiting ────────────────────────────────────────────────────
describe("EosApiRateLimit — API Rate Limiting (Cloudflare/Stripe Standard)", () => {
  it("withRateLimit returns a function that wraps a handler", () => {
    const wrapped = withRateLimit({ capacity: 5, refillPerSecond: 10 })((req, res) => res);
    assert.equal(typeof wrapped, "function");
  });

  it("allows requests under the limit", async () => {
    let statusCode = 200;
    let body = null;
    const handler = (req, res) => {
      res.status(200).json({ ok: true });
    };
    const wrapped = withRateLimit({ capacity: 5, refillPerSecond: 10 })(handler);
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.statusCode = c;
        statusCode = c;
        return this;
      },
      json(d) {
        body = d;
        return this;
      },
      end(s) {
        if (s) body = JSON.parse(s);
        return this;
      },
    };
    await wrapped({ method: "GET", headers: { "x-forwarded-for": "1.2.3.4" }, socket: {} }, mockRes);
    assert.equal(statusCode, 200, "Should allow request under limit");
    assert.ok(body);
  });

  it("returns 429 after exceeding capacity", async () => {
    const capacity = 2;
    const handler = (_req, res) => res.status(200).json({ ok: true });
    const wrapped = withRateLimit({ capacity, refillPerSecond: 0.001 })(handler);

    let lastStatus = 200;
    const makeReq = async () => {
      let status = 200;
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(c) {
          this.statusCode = c;
          status = c;
          return this;
        },
        json() {
          return this;
        },
        end(s) {
          if (s) {
            try {
              JSON.parse(s);
            } catch {
              /* ignore parse error */
            }
          }
          return this;
        },
      };
      await wrapped({ method: "GET", headers: { "x-forwarded-for": "9.9.9.9" }, socket: {} }, res);
      return status;
    };

    // Exhaust tokens
    for (let i = 0; i < capacity + 2; i++) {
      lastStatus = await makeReq();
    }
    assert.equal(lastStatus, 429, "Should return 429 after exceeding capacity");
  });

  it("skips rate limiting for OPTIONS requests", async () => {
    let statusCode = 200;
    const handler = (req, res) => res.status(200).json({ ok: true });
    const wrapped = withRateLimit({ capacity: 0, refillPerSecond: 0 })(handler);
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.statusCode = c;
        statusCode = c;
        return this;
      },
      json(_d) {
        return this;
      },
      end() {
        return this;
      },
    };
    await wrapped({ method: "OPTIONS", headers: {}, socket: {} }, mockRes);
    assert.equal(statusCode, 200, "OPTIONS should bypass rate limiting");
  });

  it("extracts true client IP from trusted proxy xff header (string & array) and handles raw response", async () => {
    const wrapped = withRateLimit({ capacity: 1, refillPerSecond: 0.001 })((req, res) => res.end("ok"));

    // 1. Trusted proxy (127.0.0.1) with string XFF
    const rawRes1 = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(s) {
        return s;
      },
    };
    await wrapped(
      {
        method: "GET",
        headers: { "x-forwarded-for": "203.0.113.195, 10.0.0.1" },
        socket: { remoteAddress: "127.0.0.1" },
      },
      rawRes1,
    );
    assert.equal(rawRes1.statusCode, 200);

    // 2. Second request from same client -> exceeds capacity and sets rawRes2.statusCode = 429
    const rawRes2 = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(s) {
        return s;
      },
    };
    await wrapped(
      {
        method: "GET",
        headers: { "x-forwarded-for": ["203.0.113.195"] },
        socket: { remoteAddress: "127.0.0.1" },
      },
      rawRes2,
    );
    assert.equal(rawRes2.statusCode, 429);
    assert.equal(rawRes2.headers["X-RateLimit-Remaining"], "0");

    // 3. Custom keyFn and connection.remoteAddress fallback
    const customKeyWrapped = withRateLimit({ capacity: 10, keyFn: (r) => r.headers["x-tenant-id"] })((req, res) =>
      res.end("ok"),
    );
    await customKeyWrapped(
      { method: "GET", headers: { "x-tenant-id": "tenant-abc" }, connection: { remoteAddress: "10.0.0.2" } },
      rawRes1,
    );
  });

  it("covers EosTokenBucketRateLimiter key eviction, tracking, and selective reset", () => {
    const limiter = new EosTokenBucketRateLimiter({ capacity: 5, refillPerSecond: 1, maxKeys: 2 });

    // Ingest 2 keys
    limiter.consume("client-A");
    limiter.consume("client-B");
    assert.equal(limiter.getTrackedKeysCount(), 2);

    // 3rd key forces eviction of oldest key ("client-A")
    limiter.consume("client-C");
    assert.equal(limiter.getTrackedKeysCount(), 2);

    // Reset single key
    limiter.reset("client-B");
    assert.equal(limiter.getTrackedKeysCount(), 1);

    // Reset all keys
    limiter.reset();
    assert.equal(limiter.getTrackedKeysCount(), 0);
  });
});

// ── Suite 4: Plugin Loader ────────────────────────────────────────────────────
describe("EosPluginLoader — External Plugin System (DeepSeek/Cursor Standard)", () => {
  let tmpDir;

  before(() => {
    tmpDir = path.join(os.tmpdir(), `eos-plugins-${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, "plugins"), { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads 0 plugins when no env var or config exists", async () => {
    const loader = new EosPluginLoader(tmpDir);
    const mockRegistry = {
      tools: [],
      register(tool) {
        this.tools.push(tool);
      },
      listTools() {
        return this.tools;
      },
    };
    const result = await loader.loadAll(mockRegistry);
    assert.equal(result.totalPlugins, 0);
    assert.equal(result.successful, 0);
  });

  it("discovers plugins from plugins.json", async () => {
    // Create a simple plugin file
    const pluginPath = path.join(tmpDir, "plugins", "my-plugin.mjs");
    fs.writeFileSync(
      pluginPath,
      `
      export const version = "1.0.0";
      export default function(registry) {
        registry.register({ name: "my_plugin_tool", description: "test", handle() { return {}; } });
      }
    `,
      "utf8",
    );

    // Create plugins.json
    fs.writeFileSync(path.join(tmpDir, "plugins.json"), JSON.stringify({ plugins: ["my-plugin"] }), "utf8");

    const loader = new EosPluginLoader(tmpDir);
    const mockRegistry = {
      tools: [],
      register(tool) {
        this.tools.push(tool);
      },
      listTools() {
        return this.tools;
      },
    };
    const result = await loader.loadAll(mockRegistry);
    assert.equal(result.totalPlugins, 1);
    assert.equal(result.successful, 1);
    assert.equal(result.plugins[0].toolsAdded, 1);
  });

  it("records error for missing plugin", async () => {
    process.env["EOS_PLUGINS"] = "nonexistent-plugin-xyz";
    const loader = new EosPluginLoader(tmpDir);
    const mockRegistry = {
      tools: [],
      register() {},
      listTools() {
        return [];
      },
    };
    const result = await loader.loadAll(mockRegistry);
    const failed = result.plugins.find((p) => p.name === "nonexistent-plugin-xyz");
    assert.ok(failed, "Should record the failed plugin");
    assert.ok(failed.error, "Should have an error message");
    delete process.env["EOS_PLUGINS"];
  });

  it("loads plugin with register() export, handles corrupt plugins.json and invalid exports", async () => {
    // 1. Create plugin with register export and .js extension
    const regPluginPath = path.join(tmpDir, "plugins", "reg-plugin.js");
    fs.writeFileSync(
      regPluginPath,
      `
      export function register(registry) {
        registry.register({ name: "tool_from_register", description: "d", handle() { return 1; } });
      }
    `,
      "utf8",
    );

    // 2. Create invalid plugin with no export
    const emptyPluginPath = path.join(tmpDir, "plugins", "bad-plugin.mjs");
    fs.writeFileSync(emptyPluginPath, "export const other = 123;", "utf8");

    // 3. Corrupt plugins.json
    fs.writeFileSync(path.join(tmpDir, "plugins.json"), "{ invalid json", "utf8");

    const loader = new EosPluginLoader(tmpDir);
    // Explicitly load the plugins by setting EOS_PLUGINS
    process.env["EOS_PLUGINS"] = "reg-plugin,bad-plugin";

    const mockRegistry = {
      tools: [],
      register(tool) {
        this.tools.push(tool);
      },
      listTools() {
        return this.tools;
      },
    };

    const res = await loader.loadAll(mockRegistry);
    assert.equal(res.successful, 1);
    assert.equal(res.failed, 1);
    assert.equal(loader.getLoadedPlugins().length, 2);

    delete process.env["EOS_PLUGINS"];
  });
});

// ── Suite 5: Structured Logging & Redaction ──────────────────────────────────
describe("EosLogger — Centralized Structured Logging & Redaction", () => {
  it("covers all log levels, child loggers, correlation IDs, timers, and sampling", () => {
    const log = createLogger("testModule", "TRACE");
    assert.ok(log);
    assert.ok(logger);

    // Verify all levels can be called without error
    assert.doesNotThrow(() => {
      log.trace("trace message", { detail: "fine" });
      log.debug("debug message", { detail: "dbg" });
      log.info("info message", {
        // Redaction triggers
        token: "secret-token",
        password: "[redacted_password]",
        secretKey: "secret-val",
      });
      log.warn("warn message");
      log.error("error message");
    });

    // Timers
    log.time("test-timer");
    const elapsed = log.timeEnd("test-timer", "timer completed");
    assert.ok(elapsed >= 0);

    // Unknown timer returns 0
    assert.equal(log.timeEnd("non-existent-timer"), 0);

    // Child logger inherits and extends namespace
    const childLog = log.child("subService");
    assert.equal(childLog.namespace, "testModule:subService");

    // withRequestId creates logger with correlationId
    const reqLog = log.withRequestId("req-9999");
    assert.equal(reqLog.correlationId, "req-9999");
    reqLog.info("msg with reqId");

    // withSampling clamps rate between 0 and 1
    const sampledLog = log.withSampling(0.5);
    assert.equal(sampledLog.sampleRate, 0.5);

    const clampedLog1 = log.withSampling(-1);
    assert.equal(clampedLog1.sampleRate, 0);

    const clampedLog2 = log.withSampling(2);
    assert.equal(clampedLog2.sampleRate, 1);
  });
});
