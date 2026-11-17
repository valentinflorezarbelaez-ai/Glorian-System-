/**
 * Glorian System — TLC Formal Verification & Mutation Ratchet Elevation Test Suite
 * Governed by SPEC-270 / CHANGE-132
 *
 * Verifies BDD-1396 through BDD-1400.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONFIGURED_SPECS,
  detectJavaRuntime,
  parseTlcOutput,
  runTlcVerification,
  validateSpecConfigPair,
} from "../scripts/run-tlc.mjs";
import { CUSTOM_TARGET_TEST_MAP, loadMutationBudget, resolveTestForTarget } from "../scripts/mutation-gate.mjs";
import {
  buildConsumerGraph,
  extractImportTargets,
  verifyModuleConsumers,
} from "../scripts/verify-module-consumers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-270: Formal TLC Model Checking, Mutation Ratchet & Consumer Governance", () => {
  // -------------------------------------------------------------------------
  // BDD-1396: Formal Model Configuration & TLC Compatibility
  // -------------------------------------------------------------------------
  it("BDD-1396: Core TLA+ specifications possess valid companion TLC .cfg models", () => {
    for (const specName of CONFIGURED_SPECS) {
      const pair = validateSpecConfigPair(specName, path.join(ROOT, "docs/formal"));
      assert.ok(pair.syntaxValid, `Model pair for ${specName} must be syntactically valid`);
      assert.ok(pair.tlaBytes > 100, `TLA+ spec ${specName}.tla must be non-empty`);
      assert.ok(pair.cfgBytes > 50, `TLC config ${specName}.cfg must be non-empty`);

      const cfgContent = fs.readFileSync(pair.cfgPath, "utf8");
      assert.ok(
        cfgContent.includes("SPECIFICATION") || cfgContent.includes("INIT"),
        `Config ${specName}.cfg must define SPECIFICATION or INIT`,
      );
      assert.ok(
        cfgContent.includes("INVARIANTS") || cfgContent.includes("INVARIANT"),
        `Config ${specName}.cfg must define INVARIANTS`,
      );
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1397: Deterministic TLC Runner & Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1397: scripts/run-tlc.mjs generates valid TLC verification evidence receipt", () => {
    assert.equal(typeof detectJavaRuntime(), "boolean");
    const receiptPath = path.join(
      ROOT,
      "docs/evidence",
      `.tlc-receipt-bdd1397-${process.pid}.json`,
    );
    try {
      const receipt = runTlcVerification({ receiptPath, forceMock: true });

      assert.equal(receipt.specRef, "SPEC-270");
      assert.equal(receipt.executionMode, "DEFERRED_TO_CI");
      assert.equal(receipt.status, "DEFERRED_TO_CI");
      assert.equal(receipt.epistemicState, "DEFERRED_TO_CI");
      assert.equal(receipt.allPassed, true);
      assert.equal(receipt.tlaJarPath, "NOT_DETECTED_LOCALLY");
      assert.equal(receipt.totalConfiguredSpecs, CONFIGURED_SPECS.length);
      assert.equal(receipt.models.length, CONFIGURED_SPECS.length);

      for (const model of receipt.models) {
        assert.ok(model.syntaxValid, `Model ${model.specName} must have valid syntax`);
      }

      assert.ok(fs.existsSync(receiptPath), "Receipt file must exist on disk");
    } finally {
      try {
        fs.unlinkSync(receiptPath);
      } catch {
        // temp receipt cleanup
      }
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1398: Negative Calibration of Formal Model Invariant
  // -------------------------------------------------------------------------
  it("BDD-1398: TLC parser detects intentional invariant violations and produces error traces", () => {
    const rawTlcFailureOutput = `
      TLC2 Version 2.18 of 01 February 2024
      Model checking completed. 4 states generated, 3 distinct states found.
      Error: Invariant SafetyInvariant is violated.
      Error: The following behavior constitutes a counter-example:
      State 1: <producerSeq = 0, consumerSeq = 0>
      State 2: <producerSeq = 5, consumerSeq = 0>
    `;

    const parsed = parseTlcOutput(rawTlcFailureOutput);
    assert.equal(parsed.passed, false, "Must fail when invariant is violated");
    assert.equal(parsed.hasError, true, "Must flag hasError=true");
    assert.equal(parsed.violationInvariant, "SafetyInvariant");
    assert.equal(parsed.distinctStates, 3);
    assert.equal(parsed.statesGenerated, 4);

    const rawTlcPassOutput = `
      TLC2 Version 2.18 of 01 February 2024
      Model checking completed. No error has been found.
      82 states generated, 45 distinct states found.
    `;
    const passParsed = parseTlcOutput(rawTlcPassOutput);
    assert.equal(passParsed.passed, true, "Must pass when no errors found");
    assert.equal(passParsed.hasError, false);
    assert.equal(passParsed.distinctStates, 45);
    assert.equal(passParsed.statesGenerated, 82);
  });

  // -------------------------------------------------------------------------
  // BDD-1399: Mutation Gate Custom Mapping and Governance Expansion
  // -------------------------------------------------------------------------
  it("BDD-1399: Mutation gate supports custom target mappings and loads budget floors", () => {
    assert.ok(
      CUSTOM_TARGET_TEST_MAP["scripts/verify-vercel-function-budget.mjs"],
      "Custom map must include verify-vercel-function-budget.mjs",
    );
    const resolvedTest = resolveTestForTarget("scripts/verify-vercel-function-budget.mjs");
    assert.equal(resolvedTest, "test/eosServerlessBudgetAndDeploymentTruth.test.mjs");

    const defaultResolved = resolveTestForTarget("src/core/eosKernelPrimitives.ts");
    assert.equal(defaultResolved, "test/eosKernelPrimitives.test.mjs");

    const budget = loadMutationBudget(ROOT);
    assert.ok(budget.minScore >= 0.8, "Default min score must be at least 0.8");
    assert.ok(Object.keys(budget.floors).length >= 15, "Mutation budget must contain at least 15 ratcheted floors");
  });

  // -------------------------------------------------------------------------
  // BDD-1400: Module Consumer Audit and Moratorium Enforcement
  // -------------------------------------------------------------------------
  it("BDD-1400: Consumer verification script audits internal dependencies and generates graph receipt", () => {
    const importCode = `
      import { EosKernelPrimitives } from "./eosKernelPrimitives.ts";
      const { runSomething } = require("./eosAutonomousHealer.js");
      await import("../src/core/eosDurableSqliteLedger.ts");
    `;
    const targets = extractImportTargets(importCode);
    assert.ok(targets.has("./eosKernelPrimitives.ts"));
    assert.ok(targets.has("./eosAutonomousHealer.js"));
    assert.ok(targets.has("../src/core/eosDurableSqliteLedger.ts"));

    const directGraph = buildConsumerGraph(ROOT);
    assert.ok(directGraph.totalModules >= 400);

    const graph = verifyModuleConsumers({ root: ROOT });
    assert.ok(graph.totalModules >= 400, "Core module count must be at least 400");
    assert.ok(graph.consumedModules >= 300, "Consumed module count must be at least 300");
    assert.ok(graph.graphDensity > 0.8, "Consumer graph density must exceed 80%");
    assert.ok(fs.existsSync(path.join(ROOT, "docs/evidence", "MODULE_CONSUMER_GRAPH.json")));
  });
});
