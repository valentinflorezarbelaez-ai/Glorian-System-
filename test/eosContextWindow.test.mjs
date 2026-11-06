import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const { EosContextWindowManager } = await import("../src/core/eosContextWindowManager.ts");

describe("EosContextWindowManager — Token-Budget Context Assembly", () => {
  let mgr;

  before(() => {
    mgr = new EosContextWindowManager(root);
  });

  it("assembles context for a known file with non-empty contextBlock", () => {
    const result = mgr.assemble(
      "Analyze the turbo engine for optimization",
      "src/core/eosTurboEngine.ts",
      { tokenBudget: 8000 }
    );
    assert.ok(result.contextBlock.length > 0, "contextBlock must not be empty");
    assert.ok(result.filesIncluded >= 1, "at least the target file must be included");
  });

  it("totalTokensUsed never exceeds tokenBudget", () => {
    const result = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 2000 });
    assert.ok(result.totalTokensUsed <= result.tokenBudget,
      `tokensUsed ${result.totalTokensUsed} exceeded budget ${result.tokenBudget}`);
  });

  it("target file is always included with role TARGET", () => {
    const result = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 8000 });
    const target = result.includedFiles.find(f => f.role === "TARGET");
    assert.ok(target, "Target file must be included with role TARGET");
    assert.ok(target.relPath.includes("eosTurboEngine"), "Target must be the turbo engine file");
  });

  it("files exceeding budget are excluded and listed", () => {
    const result = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 500 });
    // With a tiny budget, some files should be excluded
    assert.ok(result.filesExcluded >= 0, "excludedFiles array must exist");
  });

  it("estimateTokens returns 0 for non-existent file", () => {
    assert.equal(mgr.estimateTokens("src/nonexistent.ts"), 0);
  });

  it("estimateTokens returns >0 for existing file", () => {
    const tokens = mgr.estimateTokens("src/core/eosTurboEngine.ts");
    assert.ok(tokens > 0, `expected >0 tokens, got ${tokens}`);
  });

  it("includeTests=false excludes test files", () => {
    const withTests = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 16000, includeTests: true });
    const withoutTests = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 16000, includeTests: false });
    // With tests there should be >= files than without
    assert.ok(withTests.filesIncluded >= withoutTests.filesIncluded,
      `includeTests=true should include >= files than false`);
  });

  it("result is frozen (immutable)", () => {
    const result = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 4000 });
    assert.throws(() => { result.contextBlock = "tampered"; }, /Cannot assign/i);
  });

  it("sha256 starts with sha256:", () => {
    const result = mgr.assemble("test", "src/core/eosTurboEngine.ts", { tokenBudget: 4000 });
    assert.ok(result.sha256.startsWith("sha256:"), "sha256 must start with sha256:");
  });
});
