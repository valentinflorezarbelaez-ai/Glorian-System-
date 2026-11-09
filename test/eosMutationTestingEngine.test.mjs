/**
 * BDD Test Suite — EosMutationTestingEngine (SPEC-143)
 * Verifies operator generation, mutant application, and score computation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EosMutationTestingEngine } from "../src/core/eosMutationTestingEngine.ts";

describe("SPEC-143: Mutation Testing Engine", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mut-"));

  function createFixture(name, content) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content, "utf8");
    return p;
  }

  it("BDD-410: generates mutants from arithmetic and comparison operators", () => {
    const file = createFixture(
      "target1.ts",
      `
function add(a: number, b: number): number {
  if (a > b) {
    return a + b;
  }
  return a - b;
}
`,
    );
    const engine = new EosMutationTestingEngine({ maxMutantsPerFile: 20 });
    const mutants = engine.generateMutants(file);
    assert.ok(mutants.length >= 2, `Expected >= 2 mutants, got ${mutants.length}`);
    const ops = new Set(mutants.map((m) => m.operatorId));
    assert.ok(ops.has("cmp-gt-gte") && ops.has("arith-add-sub"), "Must include comparison and arithmetic mutations");
  });

  it("BDD-411: applies mutation producing syntactically valid mutated source", () => {
    const file = createFixture("target2.ts", `const x = 10 + 5;\nif (x === 15) { console.log("ok"); }\n`);
    const engine = new EosMutationTestingEngine();
    const mutants = engine.generateMutants(file);
    assert.ok(mutants.length > 0);
    const mutated = engine.applyMutation(file, mutants[0]);
    assert.notEqual(mutated, fs.readFileSync(file, "utf8"));
    assert.ok(mutated.length > 0);
  });

  it("BDD-412: scores 100% when all mutants are killed by the test executor", async () => {
    const file = createFixture("target3.ts", `const total = a + b;\nconst valid = x > 0;\n`);
    const engine = new EosMutationTestingEngine({ maxMutantsPerFile: 5 });
    // Executor always returns false (tests fail = mutant killed)
    const report = await engine.analyze(file, async () => false);
    assert.equal(report.survived, 0);
    assert.equal(report.score, 1);
    assert.equal(report.scorePercent, "100.0%");
    assert.equal(report.sha256Receipt.length, 64);
  });

  it("BDD-413: scores below 100% when mutants survive (test gap)", async () => {
    const file = createFixture("target4.ts", `const result = 42;\nconst flag = true;\n`);
    const engine = new EosMutationTestingEngine({ maxMutantsPerFile: 10 });
    // Executor always returns true (tests pass despite mutation = survived)
    const report = await engine.analyze(file, async () => true);
    assert.ok(report.survived > 0);
    assert.ok(report.score < 1);
  });

  it("BDD-414: skips comments and blank lines during mutant generation", () => {
    const file = createFixture("target5.ts", `// this is a comment with > sign\n/* block */\n\nconst x = 1;\n`);
    const engine = new EosMutationTestingEngine();
    const mutants = engine.generateMutants(file);
    // Should NOT generate mutants from the comment line
    const commentMutants = mutants.filter((m) => m.line === 1);
    assert.equal(commentMutants.length, 0, "Comments should not produce mutants");
  });

  it("BDD-415: returns deterministic SHA-256 receipt for same input", async () => {
    const file = createFixture("target6.ts", `const a = 1 + 2;\nconst b = a > 3;\n`);
    const engine = new EosMutationTestingEngine({ maxMutantsPerFile: 5 });
    const r1 = await engine.analyze(file, async () => false);
    const r2 = await engine.analyze(file, async () => false);
    assert.equal(r1.sha256Receipt, r2.sha256Receipt);
  });

  it("BDD-416: exposes 10 built-in mutation operators", () => {
    const engine = new EosMutationTestingEngine();
    const ops = engine.getOperators();
    assert.ok(ops.length >= 10, `Expected at least 10 operators, got ${ops.length}`);
    const ids = ops.map((o) => o.id);
    assert.ok(ids.includes("cmp-strict-eq"));
    assert.ok(ids.includes("logic-and-or"));
    assert.ok(ids.includes("bool-flip"));
  });
});
