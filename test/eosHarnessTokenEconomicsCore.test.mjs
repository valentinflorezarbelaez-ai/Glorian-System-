/**
 * @file eosHarnessTokenEconomicsCore.test.mjs
 * @description Verifies SPEC-377 / CHANGE-239 (BDD-2049..BDD-2056):
 * Harness Boundaries, Structured Token Economics & Deterministic Decision Router Engine.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EosHarnessTokenEconomicsCore,
  auditPromptCacheAndEconomics,
  classifyAndRouteDecision,
  compressStructuredPayload,
  encodeCompactAgentIpc,
  evaluateHarnessBoundary,
  evaluateMinimalDiffAndIpc,
} from "../src/core/eosHarnessTokenEconomicsCore.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";
import { PHASE8_TOOL_DEFINITIONS } from "../src/mcp/tools/eosMcpPhase8ToolDefinitions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_CONTRACT = {
  missionId: "BDD-MISSION-377",
  allowedPaths: ["src/core/**"],
  forbiddenPaths: ["src/auth/**", "package-lock.json"],
  maxFilesTouched: 3,
  maxDiffLines: 200,
  allowTestMutation: false,
};

describe("SPEC-377: Harness Boundaries, Structured Token Economics & Deterministic Decision Router", () => {
  it("BDD-2049: Harness boundary enforcer blocks forbidden paths, test mutations, and excess blast radius", () => {
    const res = evaluateHarnessBoundary(DEFAULT_CONTRACT, {
      changedFiles: ["src/auth/jwt.ts", "test/auth.test.mjs", "package-lock.json", "docs/random.md"],
      totalLinesAdded: 180,
      totalLinesDeleted: 50,
    });

    assert.equal(res.verdict, "HARD_BLOCK");
    assert.equal(res.blastRadiusSafe, false);
    assert.match(res.attestationHash, /^[0-9a-f]{64}$/);

    const codes = new Set(res.violations.map((v) => v.code));
    assert.ok(codes.has("FORBIDDEN_PATH"));
    assert.ok(codes.has("OUTSIDE_ALLOWED_SCOPE"));
    assert.ok(codes.has("TEST_MUTATION_BLOCKED"));
    assert.ok(codes.has("MAX_FILES_EXCEEDED"));
    assert.ok(codes.has("MAX_DIFF_LINES_EXCEEDED"));
  });

  it("BDD-2050: Harness boundary enforcer allows clean scoped changes within budget", () => {
    const res = evaluateHarnessBoundary(DEFAULT_CONTRACT, {
      changedFiles: ["./src/core/billing.ts", "src\\core\\billing.ts"],
      totalLinesAdded: 35,
      totalLinesDeleted: 10,
    });

    assert.equal(res.verdict, "ALLOW");
    assert.equal(res.blastRadiusSafe, true);
    assert.equal(res.filesEvaluated, 1);
    assert.equal(res.totalDiffLines, 45);
    assert.deepEqual(res.violations, []);
    assert.match(res.attestationHash, /^[0-9a-f]{64}$/);
  });

  it("BDD-2051: Headroom-style structured payload compressor folds homogeneous MCP/JSON arrays and achieves >= 50% savings", () => {
    const payload = {
      status: "ok",
      metadata: {
        emptyField: "",
        nullField: null,
        longNarrative: "A".repeat(260),
        nested: { a: { b: { c: { d: { e: { f: { g: "deep" } } } } } } },
      },
      mixedArray: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      records: Array.from({ length: 60 }, (_, idx) => ({
        id: idx + 1,
        service: "glorian-control-plane",
        status: "healthy",
        tokenHash: "b".repeat(128),
        unusedNull: null,
        emptyTag: "",
      })),
    };

    const report = compressStructuredPayload(payload, { maxArrayItems: 10, maxDepth: 5 });

    assert.ok(report.columnarTablesFolded >= 1);
    assert.ok(report.nullFieldsPruned >= 60);
    assert.ok(report.opaqueTokensDigested >= 10);
    assert.ok(report.savingsPercent >= 50, `Expected >= 50% savings, got ${report.savingsPercent}%`);
    assert.ok(report.tokensAfter < report.tokensBefore);
    assert.equal(report.compressedPayload.records.__format, "columnar_table");
    assert.equal(report.compressedPayload.records.totalRows, 60);
    assert.equal(report.compressedPayload.records.truncatedRows, 50);
    assert.match(report.schemaSummary, /^object\{/);

    // Scalar and array root schema summaries
    const scalarReport = compressStructuredPayload("plain-text");
    assert.equal(scalarReport.schemaSummary, "string");
    const arrReport = compressStructuredPayload([1, 2]);
    assert.equal(arrReport.schemaSummary, "array[2]");
  });

  it("BDD-2052: JEV deterministic decision classifier routes closed sets and enforces milestone-boundary prompt-cache protection", () => {
    const labels = [
      { label: "TEST_FIX", keywords: ["test", "lint", "unit", "fix"], weight: 1.2 },
      { label: "DEPLOY_CANARY", keywords: ["deploy", "canary", "rollback", "prod"], weight: 1 },
    ];

    const clearSamePhase = classifyAndRouteDecision({
      queryId: "q-clear-same",
      prompt: "Fix unit test failure and resolve lint warning",
      labels,
      currentPhase: "EXECUTION",
      previousPhase: "EXECUTION",
      activeModelTier: "BALANCED_SONNET",
    });

    assert.equal(clearSamePhase.selectedLabel, "TEST_FIX");
    assert.equal(clearSamePhase.escalatedToFrontier, false);
    assert.equal(clearSamePhase.modelSwitchAllowed, false);
    assert.equal(clearSamePhase.effectiveTier, "BALANCED_SONNET");
    assert.equal(clearSamePhase.promptCachePreserved, true);

    const milestoneSwitch = classifyAndRouteDecision({
      queryId: "q-milestone",
      prompt: "Classify lint test failure triage bucket",
      labels,
      currentPhase: "CLASSIFICATION",
      previousPhase: "PLANNING",
      activeModelTier: "FRONTIER_OPUS",
    });

    assert.equal(milestoneSwitch.modelSwitchAllowed, true);
    assert.equal(milestoneSwitch.effectiveTier, "DETERMINISTIC_LOCAL");

    const planningRoute = classifyAndRouteDecision({
      queryId: "q-plan",
      prompt: "Plan canary deploy rollback strategy",
      labels,
      currentPhase: "PLANNING",
    });
    assert.equal(planningRoute.effectiveTier, "FRONTIER_OPUS");

    const ambiguous = classifyAndRouteDecision({
      queryId: "q-ambiguous",
      prompt: "Evaluate ambiguous architectural philosophy without matching signals",
      labels,
      currentPhase: "EXECUTION",
      previousPhase: "EXECUTION",
      activeModelTier: "BALANCED_SONNET",
    });

    assert.equal(ambiguous.selectedLabel, "ABSTAIN_AMBIGUOUS");
    assert.equal(ambiguous.confidence, 0);
    assert.equal(ambiguous.escalatedToFrontier, true);
    assert.equal(ambiguous.effectiveTier, "FRONTIER_OPUS");
  });

  it("BDD-2053: Prompt cache auditor detects dynamic cache-breakers, context rot (>= 70%), and calculates session USD savings", () => {
    const broken = auditPromptCacheAndEconomics({
      sessionId: "sess-broken",
      staticPrefixSegments: [
        "System prompt built at 2026-11-22T19:30:00Z trace 550e8400-e29b-41d4-a716-446655440000 epoch 1795291023045 request_id=req-42",
        "Large static architecture reference ".repeat(350),
      ],
      dynamicSuffixSegments: ["Turn diff payload ".repeat(250)],
      turns: 12,
      contextWindowTokens: 5000,
    });

    assert.equal(broken.cachePrefixStable, false);
    assert.ok(broken.cacheBreakers.length >= 4);
    assert.equal(broken.contextRotAlert, true);
    assert.ok(broken.contextFillRatio >= 0.7);
    assert.equal(broken.promptCacheHitRate, 0);
    assert.ok(broken.optimizedCostUsd < broken.naiveCostUsd);

    const healthy = auditPromptCacheAndEconomics({
      sessionId: "sess-healthy",
      staticPrefixSegments: ["Immutable EOS Constitution & Architecture Spec ".repeat(200)],
      dynamicSuffixSegments: ["Compact turn delta ".repeat(30)],
      turns: 15,
      contextWindowTokens: 200000,
    });

    assert.equal(healthy.cachePrefixStable, true);
    assert.deepEqual(healthy.cacheBreakers, []);
    assert.equal(healthy.contextRotAlert, false);
    assert.ok(healthy.promptCacheHitRate > 0.9);
    assert.ok(healthy.savingsPercent >= 60);
  });

  it("BDD-2054: Ponytail minimal-diff gate rejects single-use abstractions/wrappers/deps and Caveman IPC compacts inter-agent frames", () => {
    const badPatch = evaluateMinimalDiffAndIpc({
      patchId: "patch-bloated",
      sourceSnippet: [
        "function singleUseHelper(v) { return v * 2; }",
        "function passThroughWrap(x) { return realFn(x); }",
        "export function main(a) { return singleUseHelper(a); }",
      ].join("\n"),
      linesAdded: 240,
      requirementsCount: 1,
      addedDependencies: ["lodash"],
    });

    assert.equal(badPatch.minimalismVerdict, "FAIL_OVERENGINEERED");
    const kinds = new Set(badPatch.findings.map((f) => f.kind));
    assert.ok(kinds.has("SINGLE_USE_ABSTRACTION"));
    assert.ok(kinds.has("PASSTHROUGH_WRAPPER"));
    assert.ok(kinds.has("EXCESSIVE_DIFF_BLOAT"));
    assert.ok(kinds.has("UNAUTHORIZED_DEPENDENCY"));

    const cleanPatch = evaluateMinimalDiffAndIpc({
      patchId: "patch-clean",
      sourceSnippet: "export function computeSum(a, b) { return a + b; }",
      linesAdded: 25,
      requirementsCount: 2,
    });
    assert.equal(cleanPatch.minimalismVerdict, "PASS");
    assert.deepEqual(cleanPatch.findings, []);

    const ipc = encodeCompactAgentIpc({
      agentFrom: "architect",
      agentTo: "implementer",
      phase: "EXECUTION",
      status: "OK",
      summary: "Please implement the validated specification successfully in order to satisfy all checks",
      changedFiles: ["src/core/eosHarnessTokenEconomicsCore.ts"],
      metrics: { pass: 8, cov: 97 },
    });

    assert.ok(ipc.compactFrame.startsWith("IPC|architect>implementer|E|OK|"));
    assert.ok(ipc.savingsPercent >= 35, `Expected >= 35% IPC savings, got ${ipc.savingsPercent}%`);
  });

  it("BDD-2055: CLI toolchain:token-econ:* handlers execute cleanly and emit valid JSON", () => {
    const cliEntry = path.join(ROOT, "bin", "eos.mjs");
    const cmds = [
      ["toolchain:token-econ:boundary", "--json"],
      ["toolchain:token-econ:compress", "--json"],
      ["toolchain:token-econ:route", "--json"],
      ["toolchain:token-econ:cache", "--json"],
      ["toolchain:token-econ:minimal", "--json"],
      ["toolchain:token-econ:diff", "--json", "--advisory"],
      ["toolchain:token-econ:audit", "--json"],
    ];

    for (const args of cmds) {
      const stdout = execFileSync(process.execPath, [cliEntry, ...args], {
        cwd: ROOT,
        encoding: "utf8",
      });
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.command, args[0]);
      if (args[0] === "toolchain:token-econ:diff") {
        assert.ok(parsed.boundary && parsed.minimalism && parsed.promptCache);
      }
    }
  });

  it("BDD-2056: EosHarnessTokenEconomicsCore.audit() and Phase-8 MCP tool produce VERIFIED SHA-256 receipt", () => {
    const toolDef = PHASE8_TOOL_DEFINITIONS.find((t) => t.name === "eos_harness_token_economics_audit");
    assert.ok(toolDef, "Phase-8 tool definition for eos_harness_token_economics_audit must exist");

    const handlers = createPhase8AgiHandlers({ projectRoot: ROOT });
    assert.equal(typeof handlers.eos_harness_token_economics_audit, "function");

    const mcpReceipt = handlers.eos_harness_token_economics_audit({});
    assert.equal(mcpReceipt.specId, "SPEC-377");
    assert.equal(mcpReceipt.changeId, "CHANGE-239");
    assert.equal(mcpReceipt.status, "VERIFIED");
    assert.equal(mcpReceipt.invariants.boundaryEnforced, true);
    assert.equal(mcpReceipt.invariants.structuredCompressionEffective, true);
    assert.equal(mcpReceipt.invariants.decisionRouterCacheSafe, true);
    assert.equal(mcpReceipt.invariants.cacheBreakerDetected, true);
    assert.equal(mcpReceipt.invariants.minimalismGateEnforced, true);
    assert.match(mcpReceipt.receiptHash, /^[0-9a-f]{64}$/);

    const receiptPath = resolveEvidencePath("HARNESS_TOKEN_ECONOMICS_RECEIPT.json", ROOT);
    assert.ok(fs.existsSync(receiptPath), "HARNESS_TOKEN_ECONOMICS_RECEIPT.json must be written");
    const persisted = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(persisted.receiptHash, mcpReceipt.receiptHash);

    // Direct facade smoke check
    assert.equal(typeof EosHarnessTokenEconomicsCore.audit, "function");
  });
});
