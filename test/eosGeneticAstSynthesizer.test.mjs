/**
 * EOS SYSTEM — GENETIC AST CODE SYNTHESIZER TEST SUITE
 * Governed by SPEC-200, CHANGE-085, ADR-085, BDD-1019..BDD-1023 (v70.0.0)
 *
 * Validates autonomous AST genetic mutation, crossover, multi-objective fitness
 * evaluation, unified diff generation, and CLI program synthesis.
 * Pure JavaScript for native Node.js test runner (zero external dependencies).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosGeneticAstSynthesizer } from "../src/core/eosGeneticAstSynthesizer.ts";

describe("EosGeneticAstSynthesizer (SPEC-200 / BDD-1019..BDD-1023)", () => {
  it("BDD-1019: AST parsing and re-serialization", () => {
    const code = "return a + b;";
    const ast = EosGeneticAstSynthesizer.parseAst(code);

    assert.equal(ast.type, "ReturnStatement");
    assert.equal(ast.argument.type, "BinaryExpression");
    assert.equal(ast.argument.operator, "+");
    assert.equal(ast.argument.left.name, "a");
    assert.equal(ast.argument.right.name, "b");

    const printed = EosGeneticAstSynthesizer.printAst(ast);
    assert.equal(printed.trim(), "return a + b;");
  });

  it("BDD-1020: Deterministic AST mutation operators", () => {
    // 1. OFF_BY_ONE_REPAIR (< to <=)
    const baseAst = EosGeneticAstSynthesizer.parseAst("a < 10");
    const mutatedOffByOne = EosGeneticAstSynthesizer.mutateAst(baseAst, "OFF_BY_ONE_REPAIR");
    assert.equal(EosGeneticAstSynthesizer.printAst(mutatedOffByOne), "a <= 10");

    // 2. INVERT_CONDITION (=== to !==)
    const eqAst = EosGeneticAstSynthesizer.parseAst("x === null");
    const mutatedInvert = EosGeneticAstSynthesizer.mutateAst(eqAst, "INVERT_CONDITION");
    assert.equal(EosGeneticAstSynthesizer.printAst(mutatedInvert), "x !== null");

    // 3. SWAP_OPERANDS (a - b to b - a)
    const subAst = EosGeneticAstSynthesizer.parseAst("a - b");
    const mutatedSwap = EosGeneticAstSynthesizer.mutateAst(subAst, "SWAP_OPERANDS");
    assert.equal(EosGeneticAstSynthesizer.printAst(mutatedSwap), "b - a");

    // 4. REPLACE_OPERATOR (+ to -)
    const addAst = EosGeneticAstSynthesizer.parseAst("a + b");
    const mutatedReplace = EosGeneticAstSynthesizer.mutateAst(addAst, "REPLACE_OPERATOR");
    assert.equal(EosGeneticAstSynthesizer.printAst(mutatedReplace), "a - b");
  });

  it("BDD-1021: AST Subtree Crossover", () => {
    const parentA = EosGeneticAstSynthesizer.parseAst("x + 1");
    const parentB = EosGeneticAstSynthesizer.parseAst("y * 42");

    const offspring = EosGeneticAstSynthesizer.crossoverAst(parentA, parentB);
    const printed = EosGeneticAstSynthesizer.printAst(offspring);

    // Offspring inherits left from parent A and right from parent B
    assert.equal(printed, "x + 42");
  });

  it("BDD-1022: Evolutionary program synthesis convergence", () => {
    // Buggy code: a - b, but test cases require a + b
    const result = EosGeneticAstSynthesizer.synthesize({
      initialCode: "a - b",
      generations: 8,
      populationSize: 12,
      testCases: [
        { input: [2, 3], expected: 5 },
        { input: [10, 25], expected: 35 },
        { input: [100, 200], expected: 300 },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.finalFitness, 100);
    assert.equal(result.bestCandidate.code, "a + b");
    assert.ok(result.generationsElapsed >= 1);
    assert.ok(result.bestCandidate.appliedMutations.includes("REPLACE_OPERATOR"));
    assert.ok(result.diffPatch.includes("- a - b"));
    assert.ok(result.diffPatch.includes("+ a + b"));
  });

  it("BDD-1023: Unified diff generation and CLI invocation", () => {
    // 1. Unified diff check
    const diff = EosGeneticAstSynthesizer.generateDiffPatch("a < 10", "a <= 10");
    assert.ok(diff.includes("- a < 10"));
    assert.ok(diff.includes("+ a <= 10"));

    // 2. CLI Invocation: glorian synthesize --json
    const rawOutput = execFileSync(process.execPath, ["bin/eos.mjs", "synthesize", "a - b", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const parsed = JSON.parse(rawOutput.trim());
    assert.equal(parsed.success, true);
    assert.equal(parsed.finalFitness, 100);
    assert.equal(parsed.bestCandidate.code, "a + b");
    assert.ok(parsed.sha256Receipt.length === 64);
    assert.ok(parsed.diffPatch.includes("- a - b"));
  });
});
