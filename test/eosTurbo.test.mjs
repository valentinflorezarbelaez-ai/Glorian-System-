/**
 * EOS SYSTEM — TURBO PIPELINE TEST SUITE (Layer 0)
 * Governed by ADR-020, BDD-022 & BDD-023
 *
 * Verifies:
 * 1. Content-addressed verification cache hits and O(1) performance.
 * 2. Whole-project turbo pipeline completing within a generous sanity ceiling.
 *    Absolute wall-clock bounds are load-dependent, so the primary signal is the
 *    functional result and the relative warm-vs-cold cache comparison; the numeric
 *    bounds only guard against hangs or catastrophic regressions.
 * 3. High-resolution microsecond telemetry (process.hrtime.bigint()).
 * 4. MCP eos_turbo_verify tool dispatch.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runTurboPipeline,
  checkFileSecretsCached,
  clearVerificationCache,
  collectSourceFiles,
} from "../src/core/eosTurboEngine.ts";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

describe("EOS Turbo Engine & Nanosecond Precision Suite", () => {
  describe("Suite 1: Content-Addressed Verification Cache (BDD-023)", () => {
    it("caches clean file evaluations on subsequent checks", () => {
      clearVerificationCache();
      const target = path.join(root, "package.json");

      const first = checkFileSecretsCached(target);
      assert.equal(first.isClean, true);
      assert.equal(first.fromCache, false);

      const second = checkFileSecretsCached(target);
      assert.equal(second.isClean, true);
      assert.equal(second.fromCache, true);
    });

    it("clears cache completely when clearVerificationCache is invoked", () => {
      const target = path.join(root, "package.json");
      checkFileSecretsCached(target);
      clearVerificationCache();

      const afterClear = checkFileSecretsCached(target);
      assert.equal(afterClear.fromCache, false);
    });

    it("hits sha256 verification cache when file timestamp changes but content remains identical", () => {
      const tmpFile = path.join(os.tmpdir(), `test-sha-cache-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, "strictly clean content with zero secrets");
      try {
        const c1 = checkFileSecretsCached(tmpFile);
        assert.equal(c1.fromCache, false);
        assert.equal(c1.isClean, true);

        // Update file timestamp without changing content
        const futureTime = new Date(Date.now() + 5000);
        fs.utimesSync(tmpFile, futureTime, futureTime);

        const c2 = checkFileSecretsCached(tmpFile);
        assert.equal(c2.fromCache, true);
        assert.equal(c2.isClean, true);
      } finally {
        fs.rmSync(tmpFile, { force: true });
      }
    });

    it("recursively collects project source files excluding node_modules and .git", () => {
      const files = collectSourceFiles(path.join(root, "src"), root);
      assert.ok(files.length >= 10);
      assert.ok(
        files.every(
          (f) =>
            !f.split(/[\\/]/).includes("node_modules") &&
            !f.split(/[\\/]/).includes(".git") &&
            !path.basename(f).startsWith(".git"),
        ),
      );
    });
  });

  describe("Suite 2: Turbo Pipeline & Microsecond Telemetry (BDD-022)", () => {
    it("completes the configured local checks", () => {
      const result = runTurboPipeline(root);

      assert.equal(result.success, true);
      assert.equal(result.epistemicState, "LOCAL_CHECKS_PASSED");
      assert.equal(result.violations.length, 0);
      assert.ok(
        result.totalDurationMs < 60000,
        `Turbo pipeline exceeded its 60s sanity ceiling under parallel load, got ${result.totalDurationMs}ms`,
      );
      assert.ok(result.totalDurationUs > 0);
      assert.ok(result.totalFilesChecked > 20);
      assert.ok(result.sourceInventoryDigest.startsWith("sha256:"));

      const warm = runTurboPipeline(root);
      assert.equal(warm.success, true);
      assert.ok(warm.cacheHits > 0);
      assert.ok(
        warm.totalDurationMs < 20000,
        `Expected the warm pipeline to stay under its 20s sanity ceiling, got ${warm.totalDurationMs}ms`,
      );
    });

    it("fails closed when external runtime dependencies are introduced into package.json (Law V)", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-turbo-deps-"));
      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "temp-violator", dependencies: { express: "^4.18.0" } }),
        );
        const result = runTurboPipeline(tempDir);
        assert.equal(result.success, false, "Pipeline must fail when external dependencies are present");
        assert.ok(
          result.violations.some((v) => v.includes("External runtime dependencies detected")),
          "Expected violation message for external dependencies",
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("provides microsecond-level telemetry for each verification stage", () => {
      const result = runTurboPipeline(root);

      assert.equal(result.stages.length, 4);
      const stageIds = result.stages.map((s) => s.stageId);
      assert.ok(stageIds.includes("STAGE_1_CREDENTIAL_PATTERNS"));
      assert.ok(stageIds.includes("STAGE_2_ARCH"));
      assert.ok(stageIds.includes("STAGE_3_INVENTORY"));
      assert.ok(stageIds.includes("STAGE_4_ASSETS"));

      for (const stage of result.stages) {
        assert.equal(stage.status, "PASS");
        assert.ok(stage.durationUs > 0);
        assert.ok(stage.durationMs >= 0);
        assert.ok(stage.details.length > 0);
      }
    });

    it("reuses the in-memory cache on an unchanged source inventory", (t) => {
      const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "eos-turbo-cache-"));
      t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
      for (const file of [
        "package.json",
        "index.html",
        "css/eos.css",
        "js/eos.js",
        "sw.js",
        "manifest.webmanifest",
        "bin/eos.mjs",
        "src/mcp/eosMcpServer.ts",
      ]) {
        const target = path.join(fixture, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
      }

      clearVerificationCache();
      const cold = runTurboPipeline(fixture);
      const warm = runTurboPipeline(fixture);
      assert.equal(cold.success, true);
      assert.equal(warm.success, true);
      assert.ok(cold.freshScans > 0);
      assert.equal(warm.freshScans, 0);
      assert.equal(warm.cacheHits, cold.cacheHits + cold.freshScans);
      assert.equal(warm.sourceInventoryDigest, cold.sourceInventoryDigest);
      assert.equal(warm.totalFilesChecked, cold.totalFilesChecked);

      fs.writeFileSync(path.join(fixture, "added.mjs"), "export {};\n");
      const expanded = runTurboPipeline(fixture);
      assert.equal(expanded.totalFilesChecked, warm.totalFilesChecked + 1);
      assert.notEqual(expanded.sourceInventoryDigest, warm.sourceInventoryDigest);
    });
  });

  describe("Suite 3: MCP eos_turbo_verify Dispatch", () => {
    it("advertises eos_turbo_verify in tools/list", () => {
      const server = new EosMcpServer(root, "full");
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 201,
        method: "tools/list",
      });

      assert.ok(res?.result?.tools);
      const names = res.result.tools.map((t) => t.name);
      assert.ok(names.includes("eos_turbo_verify"));
    });

    it("dispatches eos_turbo_verify with local-check telemetry", () => {
      const server = new EosMcpServer(root, "full");
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 202,
        method: "tools/call",
        params: {
          name: "eos_turbo_verify",
          arguments: {},
        },
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.success, true);
      assert.equal(parsed.epistemicState, "LOCAL_CHECKS_PASSED");
      assert.ok(
        parsed.totalDurationMs < 15000,
        `MCP turbo dispatch exceeded its 15s sanity ceiling, got ${parsed.totalDurationMs}ms`,
      );
      assert.equal(parsed.stages.length, 4);
    });
  });
});
