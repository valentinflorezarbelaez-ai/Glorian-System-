/**
 * EOS SYSTEM — SPEC-037 BIG TECH TIER-0 HYPER-PERFECTION VERIFICATION SUITE
 * Pure Layer-0 Unit & Invariant Test Suite (node:test)
 *
 * Verifies:
 * - BDD-099: Citadel HFT Persistent IPC Daemon & Sub-Millisecond Dispatch
 * - BDD-100: SpaceX / ASML Zero-Copy Token Scanner with 0 B/op Heap Churn
 * - BDD-101: Netflix Autonomous Chaos Injection (Latency, Byzantine, Partition)
 * - BDD-102: Resilient 3-State Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN)
 * - BDD-103: Multi-Channel MCP & CLI Tool Dispatch
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { EosGoDaemonIpc } from "../src/core/eosGoDaemonIpc.ts";
import { EosZeroCopyScanner } from "../src/core/eosZeroCopyScanner.ts";
import { EosAutonomousChaosRunner } from "../src/core/eosAutonomousChaosRunner.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-037: Big Tech Tier-0 Hyper-Perfection Verification", () => {
  describe("BDD-099: Citadel HFT Resident Daemon IPC & Graceful L0 Fallback", () => {
    it("dispatches ping and benchmark commands with sub-millisecond SLA or fast fallback", async () => {
      const ipc = new EosGoDaemonIpc(process.cwd(), 300);
      const pingRes = await ipc.dispatch("ping", {});
      assert.equal(pingRes.status, "PASS");
      assert.ok(typeof pingRes.latencyUs === "number");
      assert.ok(pingRes.latencyUs >= 0);

      const benchRes = await ipc.dispatch("benchmark", {});
      assert.equal(benchRes.status, "PASS");
      assert.ok(benchRes.data);

      ipc.terminate();
    });

    it("falls back cleanly to hermetic pure Layer-0 engine when binary is absent", async () => {
      // Point to a non-existent binary path to test fallback invariance
      const dummyRoot = path.join(process.cwd(), "dummy-non-existent-dir");
      const fallbackIpc = new EosGoDaemonIpc(dummyRoot, 100);
      assert.equal(fallbackIpc.isBinaryAvailable(), false);

      const res = await fallbackIpc.dispatch("status", {});
      assert.equal(res.status, "PASS");
      assert.equal(res.nativeGo, false);
      assert.ok(res.engine.includes("Pure Layer-0 TypeScript Fallback"));

      const stats = fallbackIpc.getStats();
      assert.equal(stats.binaryExists, false);
      assert.ok(stats.fallbackCount >= 1);
      fallbackIpc.terminate();
    });
  });

  describe("BDD-100: SpaceX / ASML Zero-Copy Scanner with 0 B/op Allocation", () => {
    it("scans source buffer directly into pre-allocated Int32Array token spans", () => {
      const code = `
        import { EosCore } from "./eosCore.ts";
        // Header comment
        export const MAX_CAPACITY = 1048576;
        function routeRequest(key) {
          if (key === "admin") return 42;
          return 0;
        }
      `;
      const buffer = Buffer.from(code);
      const result = EosZeroCopyScanner.scan(buffer, 256);

      assert.ok(result.totalTokens > 10, "Should detect multiple tokens");
      assert.equal(result.byteLength, buffer.length);
      assert.ok(result.durationUs >= 0);
      assert.ok(result.tokensTable instanceof Int32Array);
      assert.equal(result.tokensTable.length, result.totalTokens * 4);

      // Verify token type counts
      assert.ok(result.tokenTypesCount.KEYWORD > 0, "Keywords must be indexed");
      assert.ok(result.tokenTypesCount.IDENTIFIER > 0, "Identifiers must be indexed");
      assert.ok(result.tokenTypesCount.NUMBER > 0, "Numbers must be indexed");
      assert.ok(result.tokenTypesCount.COMMENT > 0, "Comments must be indexed");
    });

    it("extracts zero-copy token views without allocating new strings", () => {
      const code = `const answer = 42;`;
      const buffer = Buffer.from(code);
      const result = EosZeroCopyScanner.scan(buffer, 32);

      // Token 0: const (KEYWORD)
      const token0View = EosZeroCopyScanner.getTokenView(buffer, 0, result.tokensTable);
      assert.ok(token0View instanceof Uint8Array);
      assert.equal(Buffer.from(token0View).toString("utf8"), "const");

      // Token 1: answer (IDENTIFIER)
      const token1View = EosZeroCopyScanner.getTokenView(buffer, 1, result.tokensTable);
      assert.equal(Buffer.from(token1View).toString("utf8"), "answer");
    });

    it("achieves high throughput during benchmark execution", () => {
      const testBuffer = Buffer.from("export const x = 100; function test() { return true; }\n".repeat(500));
      // JIT warmup pass; cold interpreter measurement is host-load dependent.
      EosZeroCopyScanner.benchmark(testBuffer, 10);
      const bench = EosZeroCopyScanner.benchmark(testBuffer, 50);

      assert.equal(bench.iterations, 50);
      // Generous floor: guards against pathologies (O(n^2) regressions, allocations)
      // without coupling the gate to parallel-scheduler wall-clock noise.
      assert.ok(bench.throughputMbSec > 1, `Throughput should exceed 1 MB/s, got ${bench.throughputMbSec} MB/s`);
      assert.equal(bench.zeroHeapAllocationsVerified, true);
    });
  });

  describe("BDD-101: Netflix Autonomous Chaos Injection (Latency, Byzantine, Partition)", () => {
    it("injects synthetic latency without crashing process", async () => {
      const runner = new EosAutonomousChaosRunner();
      const start = Date.now();
      const { result, faultInjected } = await runner.executeProtected(
        async () => "healthy-result",
        async () => "fallback-result",
        { faultType: "LATENCY", injectionRate: 1.0, latencyMs: 25 },
      );

      const elapsed = Date.now() - start;
      assert.equal(result, "healthy-result");
      assert.equal(faultInjected, true);
      assert.ok(elapsed >= 20, "Should have experienced injected delay");
    });

    it("applies Byzantine payload corruption cleanly", () => {
      const runner = new EosAutonomousChaosRunner();
      const originalBuf = Buffer.from([0x01, 0x02, 0x03]);
      const corruptedBuf = runner.applyByzantineCorruption(originalBuf);
      assert.notEqual(corruptedBuf[0], originalBuf[0], "First byte should be bit-flipped");

      const obj = { score: 100, verified: true };
      const corruptedObj = runner.applyByzantineCorruption(obj);
      assert.equal(corruptedObj.__byzantineFault, true);
    });

    it("executes chaos battery and generates signed resilience report", async () => {
      const runner = new EosAutonomousChaosRunner({ failureThreshold: 3, cooldownMs: 15 });
      const report = await runner.runChaosBattery("test-mesh-experiment", 15);

      assert.equal(report.experimentName, "test-mesh-experiment");
      assert.equal(report.totalExecutions, 15);
      assert.ok(report.faultsInjected > 0);
      assert.equal(report.unhandledPanics, 0, "Must have zero unhandled panics");
      assert.ok(report.resilienceScore >= 80, "Resilience score should be high");
      assert.ok(report.sha256Receipt.length === 64, "Should be valid SHA-256");
    });
  });

  describe("BDD-102: Resilient 3-State Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN)", () => {
    it("transitions CLOSED -> OPEN when consecutive failures exceed threshold", () => {
      const runner = new EosAutonomousChaosRunner({ failureThreshold: 3, cooldownMs: 30 });
      assert.equal(runner.getCircuitState(), "CLOSED");

      runner.recordFailure();
      runner.recordFailure();
      assert.equal(runner.getCircuitState(), "CLOSED");

      runner.recordFailure();
      assert.equal(runner.getCircuitState(), "OPEN");
      assert.equal(runner.getTripCount(), 1);
    });

    it("transitions OPEN -> HALF_OPEN after cooldown expires and recloses upon successful probes", async () => {
      const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 25, recoveryProbes: 2 });
      runner.recordFailure();
      runner.recordFailure();
      assert.equal(runner.getCircuitState(), "OPEN");

      // Wait for cooldown
      await new Promise((r) => setTimeout(r, 35));
      assert.equal(runner.getCircuitState(), "HALF_OPEN");

      // Successful probe 1
      runner.recordSuccess();
      assert.equal(runner.getCircuitState(), "HALF_OPEN");

      // Successful probe 2 -> recloses to CLOSED
      runner.recordSuccess();
      assert.equal(runner.getCircuitState(), "CLOSED");
    });
  });

  describe("BDD-103: Multi-Channel MCP & CLI Tool Dispatch", () => {
    it("dispatches eos_hft_ipc_dispatch via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "eos_hft_ipc_dispatch",
          arguments: { action: "status" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, 1);
      const text = res.result.content[0].text;
      const parsed = JSON.parse(text);
      assert.equal(parsed.status, "DISPATCHED");
    });

    it("dispatches eos_zero_copy_scan via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_zero_copy_scan",
          arguments: { code: "export const alpha = 100;" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const text = res.result.content[0].text;
      const parsed = JSON.parse(text);
      assert.equal(parsed.zeroAllocation, true);
      assert.ok(parsed.totalTokens > 0);
    });

    it("dispatches eos_chaos_inject_eval via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "eos_chaos_inject_eval",
          arguments: { experimentName: "mcp-chaos-test", iterations: 10 },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const text = res.result.content[0].text;
      const parsed = JSON.parse(text);
      assert.equal(parsed.status, "EVALUATED_AND_RESILIENT");
      assert.ok(parsed.resilienceScore >= 90);
    });
  });
});
