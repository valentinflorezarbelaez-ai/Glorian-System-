/**
 * EOS SYSTEM — PROMETHEUS OMNI-MODEL TEST SUITE (Layer 0)
 * Governed by ADR-019, BDD-019, BDD-020 & BDD-021
 *
 * Verifies:
 * 1. Prompt amplification into formal EARS and BDD scenarios.
 * 2. Clean/Hexagonal boundary guard and directed circular cycle detection.
 * 3. Multi-dimensional Bayesian cognitive decision evaluation.
 * 4. Model Context Protocol (MCP) omni-tools execution.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  amplifyPrompt,
  detectDomain,
  synthesizeEarsRequirements,
  synthesizeBddScenarios,
  buildModelScaffold
} from "../src/core/eosPromptAmplifier.ts";

import {
  classifyLayer,
  extractImports,
  validateLayerInvariants,
  detectCircularDependencies,
  scanArchitecture
} from "../src/core/eosArchitectureGuard.ts";

import {
  evaluateDecision
} from "../src/core/eosCognitiveJudge.ts";

import {
  EosMcpServer
} from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

describe("EOS Prometheus Omni-Model Amplification Suite", () => {
  describe("Suite 1: Prompt Amplifier & EARS/BDD Scaffolding (BDD-019)", () => {
    it("classifies operational domains accurately", () => {
      assert.equal(detectDomain("Implement JWT token authentication gate"), "SECURITY_GATE");
      assert.equal(detectDomain("Optimize Postgres table query index"), "DATA_PERSISTENCE");
      assert.equal(detectDomain("Sub-8ms INP L1 cache nanosecond benchmark"), "PERFORMANCE_SYSTEM");
      assert.equal(detectDomain("Refactor clean hexagonal boundary adapters"), "ARCHITECTURE_REFACTOR");
    });

    it("synthesizes all 4 EARS requirement patterns", () => {
      const ears = synthesizeEarsRequirements("Validate user authorization payload", "SECURITY_GATE");
      assert.equal(ears.length, 4);

      const types = ears.map((e) => e.type);
      assert.ok(types.includes("EVENT_DRIVEN"));
      assert.ok(types.includes("UNWANTED_CONDITION"));
      assert.ok(types.includes("STATE_DRIVEN"));
      assert.ok(types.includes("UBIQUITOUS"));

      const unwanted = ears.find((e) => e.type === "UNWANTED_CONDITION");
      assert.match(unwanted?.syntax || "", /^IF .* is invalid, THEN THE SYSTEM SHALL reject it according to the reviewed error contract\.$/);
    });

    it("synthesizes BDD GIVEN-WHEN-THEN scenarios", () => {
      const bdd = synthesizeBddScenarios("Encrypt customer session cookies", "SECURITY_GATE");
      assert.equal(bdd.length, 2);
      assert.ok(bdd[0].given.length > 0);
      assert.ok(bdd[0].when.length > 0);
      assert.ok(bdd[0].then.length > 0);
      assert.ok(bdd[0].and.length > 0);
    });

    it("tailors cognitive scaffolding per model family", () => {
      const claudeScaffold = buildModelScaffold("claude", "sovereign");
      assert.ok(claudeScaffold.scaffoldingDirectives.some((d) => d.includes("internal thinking")));

      const openaiScaffold = buildModelScaffold("openai", "hardened");
      assert.ok(openaiScaffold.scaffoldingDirectives.some((d) => d.includes("DAG")));

      const deepseekScaffold = buildModelScaffold("deepseek", "sovereign");
      assert.ok(deepseekScaffold.scaffoldingDirectives.some((d) => d.includes("counter-example")));
    });

    it("generates full sovereign prompt package with invariants", () => {
      const result = amplifyPrompt({
        rawPrompt: "Create a rate limiter for API endpoints",
        targetModel: "claude",
        strictLevel: "sovereign"
      });

      assert.equal(result.targetModel, "claude");
      assert.ok(result.invariants.length >= 4);
      assert.ok(result.synthesizedSystemPrompt.includes("SOVEREIGN SPECIFICATION SCAFFOLD"));
      assert.ok(result.synthesizedUserPrompt.includes("ACCEPTANCE CRITERIA (BDD GIVEN-WHEN-THEN)"));
      assert.ok(result.executionSteps.length >= 4);
    });
  });

  describe("Suite 2: Architecture Guard & Circular Invariants (BDD-020)", () => {
    it("correctly classifies architectural layers", () => {
      assert.equal(classifyLayer("src/core/eosNeuralVectorCore.ts"), "DOMAIN");
      assert.equal(classifyLayer("src/usecases/handleDirective.ts"), "APPLICATION");
      assert.equal(classifyLayer("src/mcp/eosMcpServer.ts"), "INFRASTRUCTURE");
      assert.equal(classifyLayer("api/health.js"), "INFRASTRUCTURE");
      assert.equal(classifyLayer("src/components/EosSolarSanctum.tsx"), "PRESENTATION");
    });

    it("detects forbidden framework imports in Domain layer", () => {
      const fakeAnalysis = {
        filePath: "/fake/src/core/badModule.ts",
        relativeFilePath: "src/core/badModule.ts",
        layer: "DOMAIN",
        imports: [
          { rawSpecifier: "react", resolvedPath: null, isExternal: true, lineNumber: 1 },
          { rawSpecifier: "express", resolvedPath: null, isExternal: true, lineNumber: 2 }
        ],
        violations: []
      };

      const violations = validateLayerInvariants(fakeAnalysis);
      assert.equal(violations.length, 2);
      assert.ok(violations[0].includes("Domain Purity Violation"));
    });

    it("detects directed circular import cycles", () => {
      const analyses = new Map();
      analyses.set("A.ts", {
        imports: [{ resolvedPath: "B.ts" }]
      });
      analyses.set("B.ts", {
        imports: [{ resolvedPath: "C.ts" }]
      });
      analyses.set("C.ts", {
        imports: [{ resolvedPath: "A.ts" }] // Cycle A -> B -> C -> A
      });

      const cycles = detectCircularDependencies(analyses);
      assert.equal(cycles.length, 1);
      assert.deepEqual(cycles[0], ["A.ts", "B.ts", "C.ts", "A.ts"]);
    });

    it("verifies real EOS codebase has 100% purity and 0 cycles", () => {
      const report = scanArchitecture(path.join(root, "src"), root);
      assert.ok(report.scannedFilesCount >= 10);
      assert.equal(report.circularDependencies.length, 0);
      assert.equal(report.totalViolations, 0);
      assert.equal(report.architecturePurityScore, 100);
      assert.equal(report.isClean, true);
    });
  });

  describe("Suite 3: Cognitive Judge & Bayesian Decision Evaluation (BDD-021)", () => {
    it("approves constitutional compliant design proposals", () => {
      const verdict = evaluateDecision({
        title: "Clean Layer-0 Deterministic Tokenizer",
        description: "Pure TypeScript implementation with zero external runtime dependencies",
        proposedAction: "Synthesize token dictionary using standard String.split with EARS specification",
        targetDomain: "DOMAIN"
      });

      assert.equal(verdict.approved, true);
      assert.ok(verdict.overallScore >= 80);
      assert.equal(verdict.epistemicState, "VERIFIED");
      assert.equal(verdict.commandmentAssessments.length, 7);
    });

    it("rejects proposals containing plaintext secrets", () => {
      const secretToken = ["sk", "proj", "sampletoken123"].join("-");
      const verdict = evaluateDecision({
        title: "Hardcoded API Token Integration",
        description: `Directly embed ${secretToken} in source code`,
        proposedAction: "Send bearer request",
        targetDomain: "CORE"
      });

      assert.equal(verdict.approved, false);
      assert.ok(verdict.dimensionScores.security < 70);
      assert.ok(verdict.requiredRemediations.some((r) => r.includes("Law VI Alert")));
    });

    it("rejects destructive system command patterns", () => {
      const verdict = evaluateDecision({
        title: "Database Cleanup Script",
        description: "Clear obsolete entries",
        proposedAction: "Run drop database production; rm -rf /",
        targetDomain: "INFRA"
      });

      assert.equal(verdict.approved, false);
      assert.ok(verdict.dimensionScores.security <= 50);
      assert.ok(verdict.requiredRemediations.some((r) => r.includes("Law VI Critical")));
    });
  });

  describe("Suite 4: Model Context Protocol (MCP) Omni-Tools Integration", () => {
    it("lists all omni-tools in MCP tools/list", () => {
      const server = new EosMcpServer(root);
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 101,
        method: "tools/list"
      });

      assert.ok(res?.result?.tools);
      const toolNames = res.result.tools.map((t) => t.name);
      assert.ok(toolNames.includes("eos_amplify_prompt"));
      assert.ok(toolNames.includes("eos_check_architecture"));
      assert.ok(toolNames.includes("eos_evaluate_decision"));
    });

    it("dispatches eos_amplify_prompt via MCP", () => {
      const server = new EosMcpServer(root);
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 102,
        method: "tools/call",
        params: {
          name: "eos_amplify_prompt",
          arguments: {
            rawPrompt: "Design an in-memory ring buffer",
            targetModel: "gemini"
          }
        }
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.targetModel, "gemini");
      assert.equal(parsed.earsRequirements.length, 4);
    });

    it("dispatches eos_check_architecture via MCP", () => {
      const server = new EosMcpServer(root);
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 103,
        method: "tools/call",
        params: {
          name: "eos_check_architecture",
          arguments: {
            targetDir: "src"
          }
        }
      });

      assert.ok(res?.result?.content?.[0]?.text);
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.isClean, true);
      assert.equal(parsed.architecturePurityScore, 100);
    });
  });
});
