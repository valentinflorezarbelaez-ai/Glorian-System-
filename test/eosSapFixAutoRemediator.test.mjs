/**
 * BDD Test Suite for SPEC-291 / CHANGE-153:
 * Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine
 *
 * Verifies BDD-1521..BDD-1526.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import {
  AstMutationSaboteur,
  MutationRunner,
  SapFixSynthesizer,
  ClosedLoopRemediator,
  auditHealingPipeline,
} from "../src/core/eosSapFixAutoRemediator.ts";

describe("SPEC-291: Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing", () => {
  // BDD-1521
  test("BDD-1521: AST Operator Mutation Generation across arithmetic, relational, and boolean operators", () => {
    const saboteur = new AstMutationSaboteur();
    const source = `
export function compute(a: number, b: number, flag: boolean): boolean {
  const sum = a + b;
  const isGreater = a > b;
  if (sum === 10 && flag === true) {
    return true;
  }
  return false;
}
`;
    const mutants = saboteur.generateMutants("sample.ts", source);

    assert.ok(mutants.length >= 6);
    assert.ok(mutants.some((m) => m.category === "arithmetic" && m.originalOperator === "+"));
    assert.ok(mutants.some((m) => m.category === "relational" && m.originalOperator === ">"));
    assert.ok(mutants.some((m) => m.category === "equality" && m.originalOperator === "==="));
    assert.ok(mutants.some((m) => m.category === "logical" && m.originalOperator === "&&"));
    assert.ok(mutants.some((m) => m.category === "boolean" && m.originalOperator === "true"));

    // Verify mutant mutatedSource has exact replacement
    const plusMutant = mutants.find((m) => m.originalOperator === "+" && m.mutatedOperator === "-");
    assert.ok(plusMutant);
    assert.ok(plusMutant.mutatedSource.includes("const sum = a - b;"));
  });

  // BDD-1522
  test("BDD-1522: Automated Mutation Score Evaluation with killed vs surviving classification", async () => {
    const saboteur = new AstMutationSaboteur();
    const source = `
export function isPositive(n: number): boolean {
  return n > 0;
}
`;
    const mutants = saboteur.generateMutants("math.ts", source);
    assert.ok(mutants.length >= 1);

    // Test suite that tests isPositive(5) === true and isPositive(-1) === false
    // Mutating n > 0 to n <= 0 will cause test to fail -> KILLED
    const report = await MutationRunner.evaluateMutants("math.ts", mutants, (mutatedSource) => {
      // Evaluate mutant behavior: if operator was mutated to <=, 5 is NOT <= 0, so it fails the positive assertion!
      if (mutatedSource.includes("n <= 0")) {
        // Test fails -> mutant is killed!
        return false;
      }
      return true;
    });

    assert.equal(report.filePath, "math.ts");
    assert.ok(report.totalMutants >= 1);
    assert.ok(report.killedMutants >= 1);
    assert.ok(report.mutationScore > 0);
  });

  // BDD-1523
  test("BDD-1523: Multi-Candidate Patch Synthesis creates boundary and null-guard candidates", () => {
    const source = `
export function getScore(user: { profile: { score: number } }): number {
  return user.profile.score;
}
`;
    const candidates = SapFixSynthesizer.synthesizeCandidates("service.ts", source, 3);

    assert.ok(candidates.length >= 2);
    // Must contain null guard or optional chaining
    assert.ok(
      candidates.some((c) => c.description.includes("null check") || c.description.includes("optional chaining")),
    );
    // Candidates must be ranked by confidence score
    for (let i = 0; i < candidates.length - 1; i++) {
      assert.ok(candidates[i].confidenceScore >= candidates[i + 1].confidenceScore);
    }
  });

  // BDD-1524
  test("BDD-1524: Closed-Loop Candidate Selection and Regression Rejection", async () => {
    const source = `
export function checkThreshold(val: number): boolean {
  if (val > 100) return true;
  return false;
}
`;
    // Candidate 1 (Relax boundary) causes regression; Candidate 2 (Conditional guard) passes cleanly
    const result = await ClosedLoopRemediator.remediate("check.ts", source, 3, async (cand) => {
      if (cand.description.includes("Relax boundary with >=")) {
        // Candidate 1 passes basic test but causes regression in edge case
        return { pass: true, regression: true };
      }
      if (cand.description.includes("Conditional guard block")) {
        // Candidate 2 passes all tests cleanly without regression
        return { pass: true, regression: false };
      }
      // Other candidates fail tests
      return { pass: false, regression: false };
    });

    assert.equal(result.status, "HEALED");
    assert.ok(result.winningPatch);
    assert.ok(result.winningPatch.description.includes("Conditional guard block"));
    assert.ok(result.rejectedCandidates.some((r) => r.reason === "REGRESSION_DETECTED"));
  });

  // BDD-1525
  test("BDD-1525: Deterministic Unified Diff and Approval Hash generation", async () => {
    const source = `
export function isAllowed(age: number): boolean {
  return age > 21;
}
`;
    const result = await ClosedLoopRemediator.remediate("auth.ts", source, 3, async (cand) => {
      if (cand.description.includes("Relax boundary with >=")) {
        return { pass: true, regression: false };
      }
      return { pass: false };
    });

    assert.equal(result.status, "HEALED");
    assert.ok(result.unifiedDiff);
    assert.ok(result.unifiedDiff.includes("--- a/auth.ts"));
    assert.ok(result.unifiedDiff.includes("+++ b/auth.ts"));
    assert.ok(result.approvalHash);
    assert.equal(result.approvalHash.length, 64);
  });

  // BDD-1526
  test("BDD-1526: Cryptographic SapFix Healing Audit Receipt Verification", async () => {
    const receipt = await auditHealingPipeline({ rootDir: process.cwd(), emitReceipt: true });

    assert.equal(receipt.specRef, "SPEC-291");
    assert.ok(receipt.totalMutantsEvaluated > 0);
    assert.ok(receipt.totalPatchesSynthesized > 0);
    assert.ok(receipt.winningPatchesCount > 0);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptPath = resolveEvidencePath("SAPFIX_HEAL_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  test("Edge cases: comment/import/increment skips, exception handling, and boundary synthesis", async () => {
    const saboteur = new AstMutationSaboteur();
    const sourceWithSkips = [
      "// single line comment",
      "/* block comment */",
      " * doc comment",
      'import { foo } from "./foo.ts";',
      'import type { Bar } from "./bar.ts";',
      "",
      "export function step(i: number, j: number, k: number, m: number): number {",
      "  i++;",
      "  ++j;",
      "  k--;",
      "  --m;",
      "  const diff = i - j;",
      "  const prod = diff * 2;",
      "  return prod !== 0 || (k <= m && j >= 1) ? 1 : 0;",
      "}",
    ].join("\n");

    const mutants = saboteur.generateMutants("edge.ts", sourceWithSkips);
    assert.ok(mutants.some((m) => m.originalOperator === "-"));
    assert.ok(mutants.some((m) => m.originalOperator === "*"));
    assert.ok(mutants.some((m) => m.originalOperator === "!=="));
    assert.ok(mutants.some((m) => m.originalOperator === "||"));
    assert.ok(mutants.some((m) => m.originalOperator === "<="));
    assert.ok(mutants.some((m) => m.originalOperator === ">="));
    assert.ok(!mutants.some((m) => m.line <= 6));

    // Empty mutant set scores 1.0
    const emptyReport = await MutationRunner.evaluateMutants("empty.ts", [], () => true);
    assert.equal(emptyReport.totalMutants, 0);
    assert.equal(emptyReport.mutationScore, 1.0);

    // Exceptions (Error and non-Error) during mutant evaluation count as KILLED
    const evalReport = await MutationRunner.evaluateMutants("edge.ts", mutants.slice(0, 2), (_src, mutant) => {
      if (mutant.id === "MUT_1") {
        throw new Error("assertion failure");
      }
      throw "non-error-failure";
    });
    assert.equal(evalReport.killedMutants, 2);
    assert.equal(evalReport.mutants[0].errorOutput, "assertion failure");
    assert.equal(evalReport.mutants[1].errorOutput, "non-error-failure");

    // Out-of-range failing lines
    assert.deepEqual(SapFixSynthesizer.synthesizeCandidates("x.ts", "const x = 1;", 0), []);
    assert.deepEqual(SapFixSynthesizer.synthesizeCandidates("x.ts", "const x = 1;", 99), []);

    // All boundary operator combinations & already-safe expressions
    assert.ok(
      SapFixSynthesizer.synthesizeCandidates("b.ts", "if (a < b) return a;", 1).some((c) =>
        c.description.includes("Relax boundary with <="),
      ),
    );
    assert.ok(
      SapFixSynthesizer.synthesizeCandidates("b.ts", "if (a <= b) return a;", 1).some((c) =>
        c.description.includes("Strict boundary with <"),
      ),
    );
    assert.ok(
      SapFixSynthesizer.synthesizeCandidates("b.ts", "if (a >= b) return a;", 1).some((c) =>
        c.description.includes("Strict boundary with >"),
      ),
    );
    const safeLineCands = SapFixSynthesizer.synthesizeCandidates("b.ts", "return user?.score ?? 0;", 1);
    assert.ok(!safeLineCands.some((c) => c.description.includes("optional chaining")));
    assert.ok(!safeLineCands.some((c) => c.description.includes("nullish coalescing")));

    const blankLineCands = SapFixSynthesizer.synthesizeCandidates("b.ts", "", 1);
    assert.ok(blankLineCands.some((c) => c.replacementSnippet.includes("if (true)")));

    // ClosedLoopRemediator: validator exceptions + NO_VIABLE_PATCH
    let callIdx = 0;
    const noPatch = await ClosedLoopRemediator.remediate("fail.ts", "if (a < b) return a;", 1, async () => {
      callIdx++;
      if (callIdx === 1) throw new Error("validator error");
      if (callIdx === 2) throw "validator string crash";
      return { pass: false };
    });
    assert.equal(noPatch.status, "NO_VIABLE_PATCH");
    assert.equal(noPatch.winningPatch, undefined);
    assert.ok(noPatch.rejectedCandidates.some((r) => r.reason === "EXCEPTION: validator error"));
    assert.ok(noPatch.rejectedCandidates.some((r) => r.reason === "EXCEPTION: validator string crash"));

    // auditHealingPipeline defaults & emitReceipt: false
    const noEmitReceipt = await auditHealingPipeline({ emitReceipt: false });
    assert.equal(noEmitReceipt.specRef, "SPEC-291");
    const defaultReceipt = await auditHealingPipeline();
    assert.equal(defaultReceipt.specRef, "SPEC-291");
  });
});
