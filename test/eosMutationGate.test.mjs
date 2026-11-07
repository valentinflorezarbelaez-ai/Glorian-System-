/**
 * EOS SYSTEM — MUTATION GATE WIRING TEST (SPEC-143 de-islanding)
 *
 * Verifies scripts/mutation-gate.mjs wires EosMutationTestingEngine correctly:
 * bounded mutant generation, survivor detection, and — critically — that the
 * working tree is never mutated (all analysis happens in an isolated sandbox
 * copy of the fixture repository).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  runMutationGate,
  loadMutationBudget,
  evaluateMutationBudget,
  updateMutationBudget,
} from "../scripts/mutation-gate.mjs";

const TARGET = "src/core/eosFixtureGate.ts";

const SOURCE = ["export function bothTrue(a: boolean, b: boolean): boolean {", "  return a && b;", "}", ""].join("\n");

const FULL_TEST = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  'import { bothTrue } from "../src/core/eosFixtureGate.ts";',
  "",
  'test("bothTrue is a conjunction", () => {',
  "  assert.equal(bothTrue(true, true), true);",
  "  assert.equal(bothTrue(true, false), false);",
  "  assert.equal(bothTrue(false, true), false);",
  "});",
  "",
].join("\n");

const PARTIAL_TEST = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  'import { bothTrue } from "../src/core/eosFixtureGate.ts";',
  "",
  'test("bothTrue only checks the happy path", () => {',
  "  assert.equal(bothTrue(true, true), true);",
  "});",
  "",
].join("\n");

function buildFixture(testSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mut-fixture-"));
  fs.mkdirSync(path.join(root, "src", "core"), { recursive: true });
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "core", "eosFixtureGate.ts"), SOURCE, "utf8");
  fs.writeFileSync(path.join(root, "test", "eosFixtureGate.test.mjs"), testSource, "utf8");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "eos-mut-fixture", private: true, type: "module" }),
    "utf8",
  );
  return root;
}

describe("SPEC-143: Mutation gate (de-islanding)", () => {
  it("kills every mutant when the suite covers the behaviour", async () => {
    const root = buildFixture(FULL_TEST);
    const { reports } = await runMutationGate({ root, targets: [TARGET], maxMutantsPerFile: 5 });
    assert.equal(reports.length, 1);
    const r = reports[0];
    assert.ok(r.totalMutants >= 1, "expected at least one generated mutant");
    assert.equal(r.survived, 0);
    assert.equal(r.score, 1);
  });

  it("flags a surviving mutant as a test gap", async () => {
    const root = buildFixture(PARTIAL_TEST);
    const { reports } = await runMutationGate({ root, targets: [TARGET], maxMutantsPerFile: 5 });
    const r = reports[0];
    assert.ok(r.survived >= 1, "partial coverage must leave a survivor");
    assert.ok(r.score < 1);
    assert.ok(r.survivedMutants.every((m) => typeof m.operatorId === "string"));
  });

  it("never mutates the working tree (sandbox isolation)", async () => {
    const root = buildFixture(PARTIAL_TEST);
    const srcPath = path.join(root, "src", "core", "eosFixtureGate.ts");
    const before = fs.readFileSync(srcPath, "utf8");
    const { sandboxDir } = await runMutationGate({ root, targets: [TARGET], maxMutantsPerFile: 5 });
    assert.equal(fs.readFileSync(srcPath, "utf8"), before, "source file must be untouched");
    assert.ok(sandboxDir.includes("eos-mutate-"));
    assert.notEqual(path.resolve(sandboxDir), path.resolve(root));
  });
});

function buildBudgetRoot(budget) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mut-budget-"));
  fs.mkdirSync(path.join(root, "docs", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "quality", "mutation-budget.json"), JSON.stringify(budget), "utf8");
  return root;
}

describe("SPEC-143: Mutation score ratchet", () => {
  it("applies the default floor to a target without an explicit floor", () => {
    const root = buildBudgetRoot({ minScore: 0.8, floors: {} });
    const { violations } = evaluateMutationBudget({ root, reports: [{ targetFile: "a.ts", score: 0.75 }] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].floor, 0.8);
  });

  it("passes when the score meets its per-target floor", () => {
    const root = buildBudgetRoot({ minScore: 0.8, floors: { "a.ts": 0.9 } });
    const { violations } = evaluateMutationBudget({ root, reports: [{ targetFile: "a.ts", score: 0.9 }] });
    assert.equal(violations.length, 0);
  });

  it("raises the ratchet on improvement but never lowers it on regression", () => {
    const root = buildBudgetRoot({ minScore: 0.8, floors: { "a.ts": 0.9, "b.ts": 0.5 } });
    updateMutationBudget({
      root,
      reports: [
        { targetFile: "a.ts", score: 0.6 },
        { targetFile: "b.ts", score: 0.95 },
      ],
    });
    const { floors } = loadMutationBudget(root);
    assert.equal(floors["a.ts"], 0.9);
    assert.equal(floors["b.ts"], 0.95);
  });

  it("falls back to the default floor when the budget file is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mut-nobudget-"));
    assert.equal(loadMutationBudget(root).minScore, 0.8);
  });
});
