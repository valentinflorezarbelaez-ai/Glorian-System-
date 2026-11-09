/**
 * EOS AGI HARNESS TEST SUITE
 * Tests for EosAgiCore, EosAxiomMemory, EosMultiModelRouter (offline),
 * EosDynamicToolForge, and EosConsultantCore.
 *
 * All tests run fully offline — no AI API calls required.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ─── Imports ────────────────────────────────────────────────────────────────

const { EosAgiCore, EosAxiomMemory } = await import("../src/core/eosAgiCore.ts");
const { EosMultiModelRouter } = await import("../src/core/eosMultiModelRouter.ts");
const { EosDynamicToolForge } = await import("../src/core/eosDynamicToolForge.ts");
const { EosConsultantCore } = await import("../src/core/eosConsultantCore.ts");

// ─── Test helpers ───────────────────────────────────────────────────────────

const tmpDir = path.join(root, "_test_agi_tmp");

function ensureTmpDir() {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
}

function cleanTmpDir() {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================================
// SUITE 1: EosAxiomMemory
// ============================================================================

describe("EosAxiomMemory — Episodic Learning Engine", () => {
  let axiomPath;
  let memory;

  before(() => {
    ensureTmpDir();
    axiomPath = path.join(tmpDir, "test_axioms.json");
    memory = new EosAxiomMemory(axiomPath);
  });

  after(() => {
    cleanTmpDir();
  });

  it("starts with zero axioms", () => {
    assert.equal(memory.size, 0);
    assert.equal(memory.formatRulesBlock(), "");
  });

  it("crystallizes a new axiom from a failed branch", () => {
    const axiom = memory.crystallize(
      "Use eval() to execute dynamic code",
      "SyntaxError: Unexpected token 'export' at line 12",
    );
    assert.equal(memory.size, 1);
    assert.ok(axiom.immutableRule.includes("eval"));
    assert.equal(axiom.recurrenceCount, 1);
    assert.ok(axiom.errorHash.length > 0);
  });

  it("increments recurrenceCount on the same error pattern", () => {
    memory.crystallize("Different strategy name", "SyntaxError: Unexpected token 'export' at line 12");
    const axioms = memory.getAll();
    assert.equal(axioms.length, 1, "Same error hash should not create duplicate");
    assert.equal(axioms[0].recurrenceCount, 2);
  });

  it("creates a second axiom for a different error pattern", () => {
    memory.crystallize("Import from absolute path", "Error: Cannot find module '/abs/path/module.ts'");
    assert.equal(memory.size, 2);
  });

  it("persists axioms to disk and reloads them", () => {
    const memory2 = new EosAxiomMemory(axiomPath);
    assert.equal(memory2.size, 2);
  });

  it("formats rules block with most-recurred axioms first", () => {
    const block = memory.formatRulesBlock();
    assert.ok(block.includes("LEARNED AXIOMS"));
    assert.ok(block.includes("x2"));
    assert.ok(block.length > 50);
  });
});

// ============================================================================
// SUITE 2: EosAgiCore — Tree of Thoughts + Tribunal
// ============================================================================

describe("EosAgiCore — Tree of Thoughts + Tribunal", () => {
  let core;
  let axiomStore;

  before(() => {
    ensureTmpDir();
    axiomStore = path.join(tmpDir, "core_axioms.json");
    core = new EosAgiCore(tmpDir, axiomStore);
  });

  after(() => {
    cleanTmpDir();
  });

  it("getRulesBlock() returns empty string with no prior failures", () => {
    assert.equal(core.getRulesBlock(), "");
  });

  it("solves with a passing branch that writes a valid file", async () => {
    const targetFile = path.join(tmpDir, "solution.txt");
    const testScript = path.join(tmpDir, "verify.mjs");

    // The test script just checks the file exists and has content
    fs.writeFileSync(
      testScript,
      `
import fs from "node:fs";
const f = ${JSON.stringify(targetFile)};
if (!fs.existsSync(f)) process.exit(1);
const content = fs.readFileSync(f, "utf8");
if (!content.includes("SOLUTION")) process.exit(1);
process.exit(0);
`,
      "utf8",
    );

    const result = await core.solve(
      "Write a solution file",
      [
        {
          id: "BRANCH-001",
          strategy: "Write SOLUTION keyword to file",
          targetRelPath: "solution.txt",
          proposedContent: "SOLUTION: This file contains the answer.",
          estimatedComplexity: 1,
        },
        {
          id: "BRANCH-002",
          strategy: "Write different content",
          targetRelPath: "solution.txt",
          proposedContent: "NO_KEYWORD_HERE",
          estimatedComplexity: 2,
        },
      ],
      {
        testCommand: `node ${testScript}`,
        testCwd: tmpDir,
        timeoutMs: 5_000,
      },
    );

    assert.equal(result.solved, true);
    assert.equal(result.winningBranchId, "BRANCH-001");
    assert.equal(result.branchesEvaluated, 1); // First branch passed, stopped early
    assert.ok(result.totalDurationMs >= 0);
    assert.ok(result.executionHash.startsWith("sha256:"));
  });

  it("sorts branches by complexity and tries simplest first", async () => {
    const testScript = path.join(tmpDir, "always_fail.mjs");
    fs.writeFileSync(testScript, "process.exit(1);", "utf8");

    const result = await core.solve(
      "All branches fail",
      [
        {
          id: "BRANCH-COMPLEX",
          strategy: "Complex approach",
          targetRelPath: "x.txt",
          proposedContent: "x",
          estimatedComplexity: 9,
        },
        {
          id: "BRANCH-SIMPLE",
          strategy: "Simple approach",
          targetRelPath: "x.txt",
          proposedContent: "x",
          estimatedComplexity: 1,
        },
        {
          id: "BRANCH-MID",
          strategy: "Medium approach",
          targetRelPath: "x.txt",
          proposedContent: "x",
          estimatedComplexity: 5,
        },
      ],
      { testCommand: `node ${testScript}`, testCwd: tmpDir, timeoutMs: 3_000 },
    );

    assert.equal(result.solved, false);
    assert.equal(result.branchesEvaluated, 3);
    // Verify verdicts are ordered by complexity (SIMPLE first)
    assert.equal(result.verdicts[0].branchId, "BRANCH-SIMPLE");
    assert.equal(result.verdicts[1].branchId, "BRANCH-MID");
    assert.equal(result.verdicts[2].branchId, "BRANCH-COMPLEX");
  });

  it("crystallizes axioms for every failed branch", () => {
    // After the all-fail test above, should have axioms
    const axioms = core.getAxioms();
    assert.ok(axioms.length >= 1, "Expected at least 1 axiom from failed branches");
  });

  it("applies rollback after a failed branch — original file preserved", async () => {
    const targetFile = path.join(tmpDir, "rollback_test.txt");
    const originalContent = "ORIGINAL_CONTENT_PRESERVED";
    fs.writeFileSync(targetFile, originalContent, "utf8");

    const testScript = path.join(tmpDir, "fail_always2.mjs");
    fs.writeFileSync(testScript, "process.exit(1);", "utf8");

    await core.solve(
      "Rollback test",
      [
        {
          id: "BRANCH-001",
          strategy: "Will fail and must rollback",
          targetRelPath: "rollback_test.txt",
          proposedContent: "MUTATED_CONTENT",
          estimatedComplexity: 1,
        },
      ],
      { testCommand: `node ${testScript}`, testCwd: tmpDir, timeoutMs: 3_000 },
    );

    const afterContent = fs.readFileSync(targetFile, "utf8");
    assert.equal(afterContent, originalContent, "File must be restored after failed branch");
  });

  it("rejects branches that would escape projectRoot", async () => {
    await assert.rejects(
      () =>
        core.solve(
          "Security test",
          [
            {
              id: "BRANCH-001",
              strategy: "Escape attempt",
              targetRelPath: "../../etc/passwd",
              proposedContent: "evil",
              estimatedComplexity: 1,
            },
          ],
          { testCommand: "node --version", testCwd: tmpDir, timeoutMs: 3_000 },
        ),
      /security violation/i,
    );
  });

  it("fires all onProgress event types and handles multi-file targets & empty mutations", async () => {
    const progressEvents = [];
    const testScript = path.join(tmpDir, "verify_multi.mjs");
    fs.writeFileSync(
      testScript,
      `
import fs from "node:fs";
const ok = fs.existsSync("fileA.txt") && fs.existsSync("fileB.txt");
process.exit(ok ? 0 : 1);
`,
      "utf8",
    );

    const result = await core.solve(
      "Multi-file and empty branch test",
      [
        {
          id: "BRANCH-EMPTY",
          strategy: "No targets provided",
          targets: [],
          estimatedComplexity: 1,
        },
        {
          id: "BRANCH-MULTI",
          strategy: "Write fileA and fileB",
          targets: [
            { relPath: "fileA.txt", content: "A content" },
            { relPath: "fileB.txt", content: "B content" },
          ],
          estimatedComplexity: 2,
        },
      ],
      {
        testCommand: `node ${testScript}`,
        testCwd: tmpDir,
        timeoutMs: 3_000,
        onProgress: (evt) => progressEvents.push(evt),
      },
    );

    assert.equal(result.solved, true);
    assert.equal(result.winningBranchId, "BRANCH-MULTI");
    assert.ok(progressEvents.some((e) => e.type === "SOLVE_STARTED"));
    assert.ok(progressEvents.some((e) => e.type === "BRANCH_STARTED"));
    assert.ok(progressEvents.some((e) => e.type === "BRANCH_FAILED"));
    assert.ok(progressEvents.some((e) => e.type === "AXIOM_CRYSTALLIZED"));
    assert.ok(progressEvents.some((e) => e.type === "BRANCH_PASSED"));
    assert.ok(progressEvents.some((e) => e.type === "SOLVE_COMPLETE"));
  });

  it("handles EosAxiomMemory LRU eviction and corrupt store recovery", () => {
    const smallStore = path.join(tmpDir, "small_axioms.json");
    const mem = new EosAxiomMemory(smallStore, 2);

    mem.crystallize("strat 1", "err 1");
    mem.crystallize("strat 2", "err 2");
    assert.equal(mem.size, 2);

    // Bump recurrence on strat 1
    mem.crystallize("strat 1", "err 1");

    // Add 3rd axiom -> triggers eviction of strat 2
    mem.crystallize("strat 3", "err 3");
    assert.equal(mem.size, 2);

    // Corrupt store file recovery
    const corruptStore = path.join(tmpDir, "corrupt_axioms.json");
    fs.writeFileSync(corruptStore, "{ not-valid-json ]", "utf8");
    const recoveredMem = new EosAxiomMemory(corruptStore);
    assert.equal(recoveredMem.size, 0);
  });
});

// ============================================================================
// SUITE 3: EosMultiModelRouter — Offline / Config Tests
// ============================================================================

describe("EosMultiModelRouter — Routing Configuration", () => {
  let router;

  before(() => {
    router = new EosMultiModelRouter();
  });

  it("starts with zero usage stats", () => {
    const stats = router.getUsageStats();
    assert.equal(stats.totalCalls, 0);
    assert.equal(stats.totalEstimatedCostUsd, 0);
    assert.equal(stats.callsByTaskType.ARCHITECT, 0);
    assert.equal(stats.callsByTaskType.CODE, 0);
  });

  it("selects different models for ARCHITECT vs CODE tasks", async () => {
    // Access internal config via default export
    const { CLAUDE_OPUS, CLAUDE_HAIKU } = await import("../src/core/eosMultiModelRouter.ts");
    assert.notEqual(CLAUDE_OPUS.model, CLAUDE_HAIKU.model);
    assert.ok(
      CLAUDE_OPUS.costPer1MInputTokens > CLAUDE_HAIKU.costPer1MInputTokens,
      "Architect model should be more expensive than code model",
    );
  });

  it("fails gracefully when API key is missing", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await router.call("CODE", [{ role: "user", content: "test" }]);

    assert.equal(result.ok, false);
    assert.ok(result.error.message.includes("ANTHROPIC_API_KEY"));

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("exercises task type selection, FinOps tracking, and cache hits across all models", async () => {
    const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "mock-test-key-for-router";

    try {
      const cachedRouter = new EosMultiModelRouter();
      const branchPayload = JSON.stringify({
        branches: [
          {
            id: "BRANCH-001",
            strategy: "Minimal complexity",
            targetRelPath: "src/target.ts",
            proposedContent: "export const x = 1;",
            estimatedComplexity: 1,
          },
        ],
      });

      // Mock cache to return valid cached responses
      cachedRouter._responseCache.get = () => ({
        content: branchPayload,
        cachedAt: Date.now(),
      });

      // 1. Call ARCHITECT without system message
      const archRes = await cachedRouter.call("ARCHITECT", [{ role: "user", content: "design system" }]);
      assert.equal(archRes.ok, true);
      assert.equal(archRes.value.taskType, "ARCHITECT");
      assert.ok(archRes.value.estimatedCostUsd > 0);

      // 2. Call REVIEW with existing system message and rules block
      const revRes = await cachedRouter.call(
        "REVIEW",
        [
          { role: "system", content: "Initial system instruction" },
          { role: "user", content: "review patch" },
        ],
        "RULE-001: Law IV write barrier must hold",
      );
      assert.equal(revRes.ok, true);
      assert.equal(revRes.value.taskType, "REVIEW");

      // 3. Call SECURITY
      const secRes = await cachedRouter.call("SECURITY", [{ role: "user", content: "audit secrets" }]);
      assert.equal(secRes.ok, true);
      assert.equal(secRes.value.taskType, "SECURITY");

      // 4. Call COMPRESS
      const compRes = await cachedRouter.call("COMPRESS", [{ role: "user", content: "compress context" }]);
      assert.equal(compRes.ok, true);
      assert.equal(compRes.value.taskType, "COMPRESS");

      // 5. FinOps summary verification
      const stats = cachedRouter.getUsageStats();
      assert.equal(stats.totalCalls, 4);
      assert.equal(stats.callsByTaskType.ARCHITECT, 1);
      assert.equal(stats.callsByTaskType.REVIEW, 1);
      assert.equal(stats.callsByTaskType.SECURITY, 1);
      assert.equal(stats.callsByTaskType.COMPRESS, 1);
      assert.ok(stats.totalEstimatedCostUsd > 0);

      // 6. generateBranches with extraContext and currentContent
      const branches = await cachedRouter.generateBranches({
        objective: "Build auth module",
        targetRelPath: "src/auth.ts",
        currentContent: "// initial content",
        extraContext: "Keep hexagonal boundaries",
        branchCount: 1,
        rulesBlock: "NO_PLAIN_SECRETS",
      });
      assert.equal(branches.length, 1);
      assert.equal(branches[0].id, "BRANCH-001");

      // 7. generateBranches with markdown code fences in response
      cachedRouter._responseCache.get = () => ({
        content: `\`\`\`json\n${branchPayload}\n\`\`\``,
        cachedAt: Date.now(),
      });
      const fencedBranches = await cachedRouter.generateBranches({
        objective: "Fenced test",
        targetRelPath: "src/fenced.ts",
      });
      assert.equal(fencedBranches.length, 1);

      // 8. generateBranches with corrupt JSON in response
      cachedRouter._responseCache.get = () => ({
        content: "{ corrupted json not valid",
        cachedAt: Date.now(),
      });
      const corruptBranches = await cachedRouter.generateBranches({
        objective: "Corrupt test",
        targetRelPath: "src/corrupt.ts",
      });
      assert.deepEqual(corruptBranches, []);

      // 9. Rate limiting threshold breach
      const rateLimitedRouter = new EosMultiModelRouter({}, { maxCallsPerMinute: 1 });
      // Force rate limit queue to be full
      rateLimitedRouter._callsPerMinute.set("anthropic", [Date.now(), Date.now()]);
      const rateRes = await rateLimitedRouter.call("CODE", [{ role: "user", content: "hi" }]);
      assert.equal(rateRes.ok, false);
      assert.ok(rateRes.error.message.includes("Rate limit exceeded"));
    } finally {
      if (savedAnthropicKey) process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

// ============================================================================
// SUITE 4: EosDynamicToolForge
// ============================================================================

describe("EosDynamicToolForge — Auto-Tool Creation", () => {
  let forge;
  let forgeRoot;

  before(() => {
    ensureTmpDir();
    forgeRoot = path.join(tmpDir, "forge_workspace");
    fs.mkdirSync(forgeRoot, { recursive: true });
    forge = new EosDynamicToolForge(forgeRoot);
  });

  after(() => {
    cleanTmpDir();
  });

  it("initializes forge directory structure", () => {
    assert.ok(fs.existsSync(forge.forgeDirectory));
    assert.ok(fs.existsSync(path.join(forge.forgeDirectory, "README.md")));
  });

  it("normalizes tool names: adds eos_ prefix, removes spaces", () => {
    // Test through forge (name is normalized internally)
    const result = forge.forge({
      toolName: "My Custom Tool",
      description: "A test tool",
      inputSchema: { type: "object", properties: {} },
      moduleSource: `
export const name = "eos_my_custom_tool";
export const description = "A test tool";
export const inputSchema = { type: "object", properties: {} };
export async function execute(args) { return { ok: true }; }
`,
      requestedBy: "test",
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.toolName, "eos_my_custom_tool");
  });

  it("validates module syntax before registering", () => {
    const result = forge.forge({
      toolName: "syntax_error_tool",
      description: "Should fail",
      inputSchema: {},
      moduleSource: "this is not valid javascript }{{{",
    });
    assert.equal(result.ok, true); // forge returns Ok — but with success: false
    assert.equal(result.value.success, false);
    assert.ok(result.value.validationError);
  });

  it("rejects modules with prohibited patterns", () => {
    const result = forge.forge({
      toolName: "evil_tool",
      description: "Security test",
      inputSchema: {},
      moduleSource: `
export const name = "eos_evil_tool";
export async function execute() { return process.exit(0); }
`,
    });
    assert.equal(result.ok, false);
  });

  it("invokes a valid forged tool and returns output", async () => {
    // First forge a simple tool
    forge.forge({
      toolName: "echo_test",
      description: "Echoes the input",
      inputSchema: { type: "object", properties: { msg: { type: "string" } } },
      moduleSource: `
export const name = "eos_echo_test";
export const description = "Echoes the input";
export const inputSchema = { type: "object", properties: { msg: { type: "string" } } };
export async function execute(args) {
  return { echo: args.msg, timestamp: Date.now() };
}
`,
      requestedBy: "test",
    });

    const invocationResult = await forge.invoke("eos_echo_test", { msg: "hello sovereign" });
    assert.equal(invocationResult.success, true);
    assert.equal(invocationResult.output.echo, "hello sovereign");
    assert.ok(invocationResult.durationMs >= 0);
  });

  it("returns error for unknown tool invocation", async () => {
    const result = await forge.invoke("eos_nonexistent_tool_xyz", {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes("not found"));
  });

  it("getMcpToolDescriptors returns registered tools in MCP format", () => {
    const descriptors = forge.getMcpToolDescriptors();
    assert.ok(descriptors.length >= 1);
    const echo = descriptors.find((d) => d.name === "eos_echo_test");
    assert.ok(echo);
    assert.ok(echo.description);
    assert.ok(echo.inputSchema);
  });

  it("destroys a tool and removes it from the registry", () => {
    const destroyed = forge.destroy("eos_echo_test");
    assert.equal(destroyed, true);
    const descriptors = forge.getMcpToolDescriptors();
    const echo = descriptors.find((d) => d.name === "eos_echo_test");
    assert.equal(echo, undefined);
  });
});

// ============================================================================
// SUITE 5: EosConsultantCore — Offline Deliverable Generation
// ============================================================================

describe("EosConsultantCore — World-Class Consulting Mode", () => {
  let consultant;

  before(() => {
    ensureTmpDir();
    consultant = new EosConsultantCore(tmpDir);
  });

  after(() => {
    cleanTmpDir();
  });

  it("auto-classifies engagement type from problem description", () => {
    const result = consultant.engage({
      problem: "Our API endpoint crashes with an unhandled exception on null input",
    });
    assert.equal(result.engagementType, "BUG_INVESTIGATION");
  });

  it("auto-detects tech stack from problem context", () => {
    const result = consultant.engage({
      problem: "Need to optimize a slow TypeScript function",
      context: "Using .ts files with strict mode",
    });
    assert.equal(result.techStack, "typescript");
  });

  it("produces a complete deliverable with all required fields", () => {
    const result = consultant.engage({
      problem: "The /users endpoint returns all rows without pagination causing OOM",
      techStack: "typescript",
      engagementType: "PERFORMANCE_AUDIT",
    });

    // All required fields present
    assert.ok(result.engagementId.startsWith("ENG-"));
    assert.ok(result.executiveSummary.length > 50);
    assert.ok(result.rootCauseAnalysis.rootCause.length > 10);
    assert.ok(result.architectureRecommendation.decision.length > 10);
    assert.ok(result.implementationPlan.length >= 3);
    assert.ok(result.riskMatrix.length >= 1);
    assert.ok(result.verificationCriteria.length >= 3);
    assert.ok(result.integrityHash.startsWith("sha256:"));
    assert.ok(result.finOpsEstimate.totalEstimatedHours > 0);
    assert.ok(result.finOpsEstimate.estimatedCostUsd.mid > 0);
  });

  it("sorts risk matrix by risk score descending", () => {
    const result = consultant.engage({ problem: "Security audit of JWT handling" });
    for (let i = 0; i < result.riskMatrix.length - 1; i++) {
      assert.ok(
        result.riskMatrix[i].riskScore >= result.riskMatrix[i + 1].riskScore,
        "Risk matrix must be sorted by score descending",
      );
    }
  });

  it("generates code for N+1 query problems", () => {
    const result = consultant.engage({
      problem: "N+1 query problem in users ORM",
      techStack: "typescript",
    });
    const hasCode = result.implementationCode.some(
      (c) => c.content.includes("BatchQueryLoader") || c.content.includes("batch"),
    );
    assert.ok(hasCode, "Expected batch query optimization code");
  });

  it("generates code for JWT/auth problems", () => {
    const result = consultant.engage({
      problem: "JWT token validation is vulnerable to timing attacks",
      techStack: "typescript",
    });
    const hasCode = result.implementationCode.some((c) => c.content.includes("timingSafeEqual"));
    assert.ok(hasCode, "Expected timing-safe JWT validation code");
  });

  it("saves deliverable as markdown and returns file path", () => {
    const result = consultant.engage({
      problem: "Tech debt reduction: 500-line god class in authentication module",
      techStack: "typescript",
      engagementType: "TECH_DEBT_REDUCTION",
    });
    const filePath = consultant.saveDeliverable(result);
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("## Executive Summary"));
    assert.ok(content.includes("## Root Cause Analysis"));
    assert.ok(content.includes("## Implementation Plan"));
    assert.ok(content.includes("## Risk Matrix"));
  });

  it("produces immutable (frozen) deliverable", () => {
    const result = consultant.engage({ problem: "Immutability test" });
    assert.throws(() => {
      result.executiveSummary = "tampered";
    }, /Cannot assign/i);
  });
});
