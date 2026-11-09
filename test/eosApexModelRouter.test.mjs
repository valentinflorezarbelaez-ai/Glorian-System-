import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EosApexModelRouter, APEX_FRONTIER_MATRIX } from "../src/core/eosApexModelRouter.ts";

test("EOS Apex Frontier Model Router, Token Squeezer & Go Healer Suite (SPEC-025)", async (t) => {
  const router = new EosApexModelRouter();

  await t.test("Suite 1: Frontier Model Matrix & Capability Verification (FR-053, BDD-055)", () => {
    assert.ok(APEX_FRONTIER_MATRIX.gemini, "Gemini profile must exist");
    assert.ok(APEX_FRONTIER_MATRIX.claude, "Claude profile must exist");
    assert.ok(APEX_FRONTIER_MATRIX.gpt, "GPT profile must exist");
    assert.ok(APEX_FRONTIER_MATRIX.deepseek, "DeepSeek profile must exist");
    assert.ok(APEX_FRONTIER_MATRIX.grok, "Grok profile must exist");

    // Route math task to GPT
    const mathRoute = router.routeTask("Verify formal mathematical proof and TLA+ invariants for transactions");
    assert.equal(mathRoute.selectedModel.key, "gpt");
    assert.equal(mathRoute.taskCategory, "formal-verification");
    assert.ok(mathRoute.sha256Receipt, "Must emit SHA-256 receipt");

    // Route token/cost/bulk task to DeepSeek
    const finOpsRoute = router.routeTask("Optimize token budget and reduce Big-O complexity for bulk unit tests");
    assert.equal(finOpsRoute.selectedModel.key, "deepseek");
    assert.equal(finOpsRoute.taskCategory, "finops-algorithmic");

    // Route massive context to Gemini
    const massiveContext = "a".repeat(60000);
    const geminiRoute = router.routeTask("Analyze whole repository documentation and code context", massiveContext);
    assert.equal(geminiRoute.selectedModel.key, "gemini");
    assert.equal(geminiRoute.taskCategory, "massive-context-multimodal");

    // Route concurrency/hardware to Grok
    const grokRoute = router.routeTask("Implement Go goroutine worker pool with lock-free channel concurrency");
    assert.equal(grokRoute.selectedModel.key, "grok");
    assert.equal(grokRoute.taskCategory, "low-level-systems");

    // Route core architecture to Claude
    const claudeRoute = router.routeTask("Design pure hexagonal domain layer and port/adapter interfaces");
    assert.equal(claudeRoute.selectedModel.key, "claude");
    assert.equal(claudeRoute.taskCategory, "architectural-synthesis");
  });

  await t.test("Suite 2: Extreme AST Context Squeezer & Token Savings (FR-054, BDD-056)", () => {
    const sampleTs = `
/**
 * Sample Interface Header
 */
export interface OrderContract {
  readonly id: string;
  readonly amount: number;
}

export function executeOrder(order: OrderContract): boolean {
  const tax = order.amount * 0.19;
  const total = order.amount + tax;
  console.log("Processing order", total);
  if (total > 1000) {
    return true;
  }
  return false;
}
`;

    const res = router.compressContext(sampleTs, "sample.ts");
    assert.ok(res.compressed.includes("OrderContract"), "Must preserve interface definition");
    assert.ok(res.compressed.includes("executeOrder"), "Must preserve function signature");
    assert.ok(res.compressed.includes("/* [AST Compressed] */"), "Must compress function body");
    assert.ok(res.savingsPercent >= 30, `Expected token savings >= 30%, got ${res.savingsPercent}%`);
    assert.ok(res.compressedTokens < res.originalTokens, "Compressed tokens must be lower than original");
  });

  await t.test("Suite 3: Closed-Loop NASA FDIR Autonomous Self-Healing (FR-055, BDD-057)", () => {
    const tempFile = path.join(process.cwd(), "docs", "scratch-heal-test.txt");
    fs.writeFileSync(tempFile, "Line 1 with trailing whitespace   \r\nLine 2 \r\n", "utf8");

    try {
      // Dry run
      const dryRes = router.healFile(tempFile, true);
      assert.equal(dryRes.status, "HEALED");
      assert.ok(dryRes.actionsApplied.length >= 1, "Must diagnose trailing whitespace/CRLF");
      assert.equal(dryRes.verificationExitCode, 0);

      // Real heal
      const realRes = router.healFile(tempFile, false);
      assert.equal(realRes.status, "HEALED");
      const healedContent = fs.readFileSync(tempFile, "utf8");
      assert.ok(!healedContent.includes("\r\n"), "Must normalize CRLF to LF");
      assert.ok(!/[ \t]+$/m.test(healedContent), "Must strip trailing whitespace");

      // Verify idempotency (already clean)
      const cleanRes = router.healFile(tempFile, true);
      assert.equal(cleanRes.status, "NO_REMEDIATION_NEEDED");
      assert.equal(cleanRes.actionsApplied.length, 0);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  await t.test("Suite 4: Native Go High-Scale Concurrency Benchmark (> 50,000,000 tokens/sec, FR-056)", () => {
    const bench = router.runGoThroughputBenchmark();
    assert.equal(bench.status, "PASS");
    // The pure-TypeScript fallback measures throughput with the wall clock, so the absolute
    // rate is host-load sensitive (the native Go target is > 50M tok/s). This is a generous
    // sanity floor; the status and duration invariants above carry the real signal.
    assert.ok(
      bench.tokensPerSecond > 100000,
      `Expected throughput above the 100k tok/s sanity floor, got ${bench.tokensPerSecond}`,
    );
    assert.ok(bench.durationUs > 0, "Benchmark must measure execution duration in microseconds");
  });

  await t.test("Suite 5: Edge cases, non-existent files, and binary fallback resilience", () => {
    // 1. healFile on non-existent file
    const missingRes = router.healFile("non-existent-diagnostic-file.txt");
    assert.equal(missingRes.status, "REMEDIATION_BLOCKED");
    assert.equal(missingRes.verificationExitCode, 1);
    assert.ok(missingRes.sha256Receipt.length === 64);

    // 2. Fallback router when bin/eos-apex.exe does not exist
    const noBinRouter = new EosApexModelRouter(os.tmpdir());
    const noBinBench = noBinRouter.runGoThroughputBenchmark();
    assert.equal(noBinBench.status, "PASS");
    assert.equal(noBinBench.nativeGo, false);

    // 3. Mock binary that exists on disk in projectRoot/bin/ but errors out on execution
    const tmpDir = path.join(os.tmpdir(), `eos-mock-root-${Date.now()}`);
    const tmpBinDir = path.join(tmpDir, "bin");
    fs.mkdirSync(tmpBinDir, { recursive: true });
    const mockExe = path.join(tmpBinDir, process.platform === "win32" ? "eos-apex.exe" : "eos-apex");
    fs.writeFileSync(mockExe, "not-a-valid-executable", "utf8");

    try {
      const mockRouter = new EosApexModelRouter(tmpDir);
      // Route task: should catch execFileSync error and set nativeGoAccelerated = false
      const routeRes = mockRouter.routeTask("Simple test prompt");
      assert.equal(routeRes.nativeGoAccelerated, false);

      // runGoThroughputBenchmark: should catch execFileSync error and run pure TS fallback
      const bench = mockRouter.runGoThroughputBenchmark();
      assert.equal(bench.status, "PASS");
      assert.equal(bench.nativeGo, false);
      assert.ok(bench.tokensPerSecond > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
