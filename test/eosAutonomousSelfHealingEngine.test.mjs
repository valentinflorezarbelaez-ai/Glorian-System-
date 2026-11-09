import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EosAutonomousSelfHealingEngine } from "../src/core/eosAutonomousSelfHealingEngine.ts";

describe("SPEC-150: Autonomous Closed-Loop Self-Healing Engine Test Suite", () => {
  const engine = new EosAutonomousSelfHealingEngine();

  it("isolates faults across stack traces, property errors, function errors, and badges", () => {
    // 1. Stack trace pattern
    const stackReport = "Error: Boom\n    at computeTotal (src/core/eosPromptAmplifier.ts:15:20)";
    const fault1 = engine.isolateFault(stackReport);
    assert.equal(fault1.targetFile, "src/core/eosPromptAmplifier.ts");
    assert.equal(fault1.line, 15);
    assert.ok(fault1.affectedNodes.includes("src/core/eosPromptAmplifier.ts"));
    assert.ok(fault1.affectedNodes.includes("src/mcp/eosMcpServer.ts"));

    // 2. Cannot read property of undefined
    const propReport = "TypeError: Cannot read property 'totalAmount' of undefined";
    const fault2 = engine.isolateFault(propReport);
    assert.equal(fault2.targetSymbol, "totalAmount");

    // 3. TypeError is not a function
    const funcReport = "TypeError: processBatch is not a function";
    const fault3 = engine.isolateFault(funcReport);
    assert.equal(fault3.targetSymbol, "processBatch");

    // 4. Violation badge pattern
    const badgeReport = "[MEMORY_LEAK] Buffer pool threshold exceeded";
    const fault4 = engine.isolateFault(badgeReport);
    assert.equal(fault4.targetSymbol, "MEMORY_LEAK");

    // 5. Fallback when report has no matches
    const emptyReport = "Unknown failure without identifiable markers";
    const fault5 = engine.isolateFault(emptyReport);
    assert.equal(fault5.targetFile, "src/core/eosAutonomousSelfHealingEngine.ts");
    assert.equal(fault5.targetSymbol, undefined);
  });

  it("synthesizes candidate mutations across all 5 healing archetypes", () => {
    // 1. NULL_POINTER_GUARD
    const nullCands = engine.synthesizeCandidateMutations("src/core/sample.ts", "NULL_POINTER_GUARD", {
      symbol: "order",
      originalSnippet: "order.items",
    });
    assert.equal(nullCands.length, 2);
    assert.ok(nullCands[0].mutatedSnippet.includes("?."));
    assert.ok(nullCands[1].mutatedSnippet.includes("getValue"));

    // 2. TIMEOUT_BACKOFF_RETRY
    const retryCands = engine.synthesizeCandidateMutations("src/core/sample.ts", "TIMEOUT_BACKOFF_RETRY");
    assert.equal(retryCands.length, 1);
    assert.ok(retryCands[0].mutatedSnippet.includes("attempt <= 5"));

    // 3. GRID_SPACING_CONFORMANCE
    const gridCands = engine.synthesizeCandidateMutations("src/core/sample.ts", "GRID_SPACING_CONFORMANCE");
    assert.equal(gridCands.length, 1);
    assert.ok(gridCands[0].mutatedSnippet.includes("padding: 12px 16px;"));

    // 4. FALLBACK_VALUE_INJECT
    const fallbackCands = engine.synthesizeCandidateMutations("src/core/sample.ts", "FALLBACK_VALUE_INJECT");
    assert.equal(fallbackCands.length, 1);
    assert.ok(fallbackCands[0].mutatedSnippet.includes("?? []"));

    // 5. IMPORT_CYCLE_BREAK
    const cycleCands = engine.synthesizeCandidateMutations("src/core/sample.ts", "IMPORT_CYCLE_BREAK");
    assert.equal(cycleCands.length, 1);
    assert.ok(cycleCands[0].mutatedSnippet.includes("import type"));
  });

  it("evaluates candidates in sandbox with passing, failing, and syntax exception paths", () => {
    const candidate = {
      id: "MUT-TEST",
      archetype: "NULL_POINTER_GUARD",
      targetFile: "src/core/sample.ts",
      originalSnippet: "a.b",
      mutatedSnippet: "a?.b",
      rationale: "Null guard",
      diff: "- a.b\n+ a?.b",
    };

    // Passing evaluation
    const evalPass = engine.evaluateCandidateInSandbox(candidate);
    assert.equal(evalPass.passed, true);
    assert.equal(evalPass.testsPassed, 1);
    assert.equal(evalPass.regressionFindings.length, 0);

    // Failing evaluation (sandbox returns false)
    const evalFail = engine.evaluateCandidateInSandbox(candidate, "candidateResult = false;");
    assert.equal(evalFail.passed, false);
    assert.ok(evalFail.regressionFindings[0].includes("returned false"));

    // Exception during evaluation
    const evalErr = engine.evaluateCandidateInSandbox(candidate, "throw new Error('Sandbox blown up');");
    assert.equal(evalErr.passed, false);
    assert.ok(evalErr.regressionFindings[0].includes("Sandbox evaluation exception"));
  });

  it("executes runAutonomousHealingLoop nominal dryRun and archetype inferences", () => {
    // 1. Inferred NULL_POINTER_GUARD
    const rep1 = engine.runAutonomousHealingLoop({
      diagnosticReport: "TypeError: Cannot read properties of undefined (reading 'config')",
      dryRun: true,
    });
    assert.equal(rep1.status, "HEALED");
    assert.equal(rep1.archetype, "NULL_POINTER_GUARD");
    assert.ok(rep1.appliedMutation);
    assert.equal(rep1.sha256Receipt.length, 64);
    assert.ok(rep1.traceId);

    // 2. Inferred TIMEOUT_BACKOFF_RETRY
    const rep2 = engine.runAutonomousHealingLoop({
      diagnosticReport: "Error: EBUSY: resource locked or busy during write",
      dryRun: true,
    });
    assert.equal(rep2.status, "HEALED");
    assert.equal(rep2.archetype, "TIMEOUT_BACKOFF_RETRY");

    // 3. Inferred GRID_SPACING_CONFORMANCE
    const rep3 = engine.runAutonomousHealingLoop({
      diagnosticReport: "Style violation: GRID non-conformance detected on 10px spacing",
      dryRun: true,
    });
    assert.equal(rep3.status, "HEALED");
    assert.equal(rep3.archetype, "GRID_SPACING_CONFORMANCE");

    // 4. Inferred FALLBACK_VALUE_INJECT
    const rep4 = engine.runAutonomousHealingLoop({
      diagnosticReport: "Unexpected empty data return structure",
      dryRun: true,
    });
    assert.equal(rep4.status, "HEALED");
    assert.equal(rep4.archetype, "FALLBACK_VALUE_INJECT");
  });

  it("executes runAutonomousHealingLoop with real file on disk (dryRun: false)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-auto-healing-real-"));
    try {
      const sampleFile = path.join(tmpDir, "testTarget.ts");
      const originalCode = `
        export function readData(result: any) {
          return result.data;
        }
      `;
      fs.writeFileSync(sampleFile, originalCode, "utf8");

      const localEngine = new EosAutonomousSelfHealingEngine({ projectRoot: tmpDir });
      const report = localEngine.runAutonomousHealingLoop({
        targetFile: sampleFile,
        diagnosticReport: "Empty data return",
        archetype: "FALLBACK_VALUE_INJECT",
        dryRun: false,
      });

      assert.equal(report.status, "HEALED");
      const updatedCode = fs.readFileSync(sampleFile, "utf8");
      assert.ok(updatedCode.includes("return result?.data ?? [];"));

      // Verify history
      const history = localEngine.getHealingHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].healingId, report.healingId);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles rollback when candidate evaluation fails", () => {
    const origSynth = engine.synthesizeCandidateMutations;
    try {
      // Mock synthesis to return candidate that fails sandbox
      engine.synthesizeCandidateMutations = () => [
        {
          id: "MUT-FAIL",
          archetype: "NULL_POINTER_GUARD",
          targetFile: "dummy.ts",
          originalSnippet: "old",
          mutatedSnippet: "new",
          rationale: "Will fail",
          diff: "- old\n+ new",
        },
      ];

      const origEval = engine.evaluateCandidateInSandbox;
      try {
        engine.evaluateCandidateInSandbox = () => ({
          candidateId: "MUT-FAIL",
          passed: false,
          testsRun: 1,
          testsPassed: 0,
          executionTimeMs: 1,
          memoryUsageMb: 0.1,
          regressionFindings: ["Forced evaluation regression"],
        });

        const report = engine.runAutonomousHealingLoop({
          diagnosticReport: "Some failure",
          dryRun: true,
        });

        assert.equal(report.status, "ROLLED_BACK");
        assert.equal(report.appliedMutation, null);
      } finally {
        engine.evaluateCandidateInSandbox = origEval;
      }
    } finally {
      engine.synthesizeCandidateMutations = origSynth;
    }
  });
});
