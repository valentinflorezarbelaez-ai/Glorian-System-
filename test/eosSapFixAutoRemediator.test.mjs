/**
 * BDD Test Suite for SPEC-291 / CHANGE-153:
 * Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine
 *
 * Verifies BDD-1521..BDD-1526.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
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

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "SAPFIX_HEAL_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
