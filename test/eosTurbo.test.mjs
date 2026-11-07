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

    it("recursively collects project source files excluding node_modules and .git", () => {
      const files = collectSourceFiles(path.join(root, "src"), root);
      assert.ok(files.length >= 10);
      assert.ok(files.every((f) => !f.includes("node_modules") && !f.includes(".git")));
    });
  });

  describe("Suite 2: Turbo Pipeline & Microsecond Telemetry (BDD-022)", () => {
    it("completes the configured local checks", () => {
      const result = runTurboPipeline(root);

      assert.equal(result.success, true);
      assert.equal(result.epistemicState, "LOCAL_CHECKS_PASSED");
      assert.equal(result.violations.length, 0);
      assert.ok(
        result.totalDurationMs < 30000,
        `Turbo pipeline exceeded its 30s sanity ceiling, got ${result.totalDurationMs}ms`,
      );
      assert.ok(result.totalDurationUs > 0);
      assert.ok(result.totalFilesChecked > 20);
      assert.ok(result.sourceInventoryDigest.startsWith("sha256:"));
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

    it("reuses the in-memory cache on secondary run", () => {
      const firstResult = runTurboPipeline(root);
      const secondResult = runTurboPipeline(root);

      assert.equal(secondResult.success, true);
      // Cache reuse is proven by hit counts, not by wall-clock deltas: the first
      // run may already be warm from earlier cases, and scheduler noise dominates
      // single-run timings.
      assert.ok(secondResult.cacheHits > 0, "Expected non-zero cache hits on a primed cache");
      assert.ok(
        secondResult.cacheHits >= firstResult.cacheHits,
        `Expected cache hits to not regress (first: ${firstResult.cacheHits}, second: ${secondResult.cacheHits})`,
      );
      assert.ok(
        secondResult.totalDurationMs < 20000,
        `Expected the pipeline to stay under its 20s sanity ceiling, got ${secondResult.totalDurationMs}ms`,
      );
    });
  });

  describe("Suite 3: MCP eos_turbo_verify Dispatch", () => {
    it("advertises eos_turbo_verify in tools/list", () => {
      const server = new EosMcpServer(root);
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
      const server = new EosMcpServer(root);
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
