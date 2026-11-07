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

// ── Suite 1: Feature Flags ───────────────────────────────────────────────────
describe("EosFeatureFlags — Progressive Delivery (Stripe/Netflix Standard)", () => {
  it("reads default values from the built-in config", () => {
    const flags = new EosFeatureFlags();
    // These are enabled by default
    assert.equal(flags.isEnabled("agi_pipeline"), true);
    assert.equal(flags.isEnabled("consultant_offline"), true);
    assert.equal(flags.isEnabled("graph_cache"), true);
    // These are disabled by default (require explicit opt-in)
    assert.equal(flags.isEnabled("chaos_in_ci"), false);
    assert.equal(flags.isEnabled("perf_regression"), false);
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
});
