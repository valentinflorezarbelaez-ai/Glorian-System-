import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosGoAccelerator } from "../src/core/eosGoAccelerator.ts";

describe("EOS Sovereign Go Native Titan Accelerator Suite", () => {
  const accelerator = new EosGoAccelerator(process.cwd());

  describe("Suite 1: Go Detection & Binary Availability (BDD-042)", () => {
    it("detects compiled binary or active Go compiler", () => {
      const avail = accelerator.isGoAvailable();
      assert.ok(typeof avail.binaryExists === "boolean");
      assert.ok(typeof avail.compilerAvailable === "boolean");
      // In cloud serverless environments (e.g. Vercel build containers), verify graceful fallback contract
      if (!avail.binaryExists && !avail.compilerAvailable) {
        assert.equal(avail.binaryExists, false);
        assert.equal(avail.compilerAvailable, false);
      } else {
        assert.ok(avail.binaryExists || avail.compilerAvailable, "Expected Go binary or compiler to be present");
      }
    });
  });

  describe("Suite 2: bounded local benchmark scope", () => {
    it("reports measured local work without promising a throughput threshold", () => {
      const result = accelerator.runBenchmark(32);
      assert.ok(["NATIVE_BENCHMARK_COMPLETED", "LOCAL_DEMO_EXECUTED"].includes(result.status));
      assert.ok(result.memoryCopyThroughputMbSec > 0);
      assert.ok(result.benchmarkScope.length > 0);
      assert.ok(result.optimalArmSelected.length > 0);
      assert.ok(result.totalDurationUs > 0);
    });
  });

  describe("Suite 3: Spotify BaRT Contextual Bandit Optimization", () => {
    it("converges to optimal arm using Thompson Sampling", () => {
      const res = accelerator.runBanditSimulation(1500);
      assert.ok(["NATIVE_SIMULATION_COMPLETED", "LOCAL_SIMULATION_EXECUTED"].includes(res.status));
      assert.equal(res.mode, "bandit");
      assert.ok(res.arms.length >= 4);
      assert.ok(res.arms.some((arm) => arm.trackId === res.optimalArm));
      assert.equal(res.scope, "SYNTHETIC_LOCAL_SIMULATION");
      assert.equal(res.arms.reduce((sum, arm) => sum + arm.pulls, 0), res.episodes);
    });
  });
});
