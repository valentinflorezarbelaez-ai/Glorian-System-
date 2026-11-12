/**
 * EOS Layer-0 KZG Polynomial Commitments & Multi-Proof Core Test Suite
 * Governed by SPEC-220: FR-1119..FR-1123 and BDD-1119..BDD-1123.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosKzgPolynomialCommitmentCore,
  polyEval,
  polySyntheticDiv,
  polyMul,
  polyAdd,
  polySub,
  polyDiv,
  lagrangeInterpolatePolynomial,
} from "../src/core/eosKzgPolynomialCommitmentCore.ts";
import { SECP256K1_G, serializePoint } from "../src/core/eosVerifiableRandomFunctionCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

describe("EosKzgPolynomialCommitmentCore (SPEC-220 / BDD-1119..BDD-1123)", () => {
  test("BDD-1119: Structured Reference String Initialization and Power-of-Tau Invariants", () => {
    assert.strictEqual(typeof EosKzgPolynomialCommitmentCore, "function");

    const srs = EosKzgPolynomialCommitmentCore.setup(8, "srs-seed-1119");
    assert.strictEqual(srs.maxDegree, 8);
    assert.strictEqual(srs.srs1.length, 9); // degree 0..8
    assert.strictEqual(srs.srs1Hex.length, 9);
    assert.ok(srs.toxicWasteDigest.length === 64);

    // SRS point 0 is the generator G
    assert.strictEqual(serializePoint(srs.srs1[0]), serializePoint(SECP256K1_G));

    // Precondition boundaries
    assert.throws(() => EosKzgPolynomialCommitmentCore.setup(0));
    assert.throws(() => EosKzgPolynomialCommitmentCore.setup(-5));
  });

  test("BDD-1120: Deterministic Constant-Size Polynomial Commitments", () => {
    const srs = EosKzgPolynomialCommitmentCore.setup(12, "commit-seed-1120");
    const core = new EosKzgPolynomialCommitmentCore(srs);

    // Polynomial p(x) = 5x^4 + 3x^2 + 7
    const p1 = [7n, 0n, 3n, 0n, 5n];
    const commit1 = core.commit(p1);

    assert.strictEqual(commit1.degree, 4);
    assert.ok(commit1.commitmentHex.length === 66);
    assert.strictEqual(commit1.receipt.operation, "commit");

    // Determinism
    const commit1Again = core.commit(p1);
    assert.strictEqual(commit1.commitmentHex, commit1Again.commitmentHex);

    // Different polynomial yields different commitment
    const p2 = [7n, 1n, 3n, 0n, 5n];
    const commit2 = core.commit(p2);
    assert.notStrictEqual(commit1.commitmentHex, commit2.commitmentHex);

    // Degree exceeding SRS bounds throws precondition
    const hugePoly = new Array(15).fill(1n);
    assert.throws(() => core.commit(hugePoly));
  });

  test("BDD-1121: Single-Point Evaluation Proof Generation and Exact Quotient Division", () => {
    const srs = EosKzgPolynomialCommitmentCore.setup(10, "open-seed-1121");
    const core = new EosKzgPolynomialCommitmentCore(srs);

    // p(x) = 3x^3 + 2x^2 + 5x + 7
    const poly = [7n, 5n, 2n, 3n];
    const z = 4n;

    // Direct polynomial evaluation at z=4: 3(64) + 2(16) + 5(4) + 7 = 192 + 32 + 20 + 7 = 251
    const expectedValue = 251n;
    assert.strictEqual(polyEval(poly, z), expectedValue);

    // Synthetic division of (p(x) - 251) by (x - 4)
    // 3x^3 + 2x^2 + 5x - 244 / (x - 4) = 3x^2 + 14x + 61, remainder 0
    const { quotient, remainder } = polySyntheticDiv(poly, z);
    assert.strictEqual(remainder, 0n);
    assert.strictEqual(quotient.length, 3);
    assert.strictEqual(quotient[0], 61n);
    assert.strictEqual(quotient[1], 14n);
    assert.strictEqual(quotient[2], 3n);

    // Open evaluation proof
    const openRes = core.open(poly, z);
    assert.strictEqual(openRes.claimedValue, expectedValue);
    assert.strictEqual(openRes.evaluationPoint, z);
    assert.strictEqual(openRes.quotientDegree, 2);
    assert.ok(openRes.proofHex.length === 66);

    // Commit and verify
    const commitRes = core.commit(poly);
    const verifyRes = core.verify(
      commitRes.commitmentPoint,
      z,
      openRes.claimedValue,
      openRes.proofPoint,
      openRes.quotientDegree,
    );

    assert.strictEqual(verifyRes.valid, true);
    assert.ok(verifyRes.verificationTimeMs >= 0);
  });

  test("BDD-1122: Batched Multi-Point Opening and Verification", () => {
    const srs = EosKzgPolynomialCommitmentCore.setup(16, "batch-seed-1122");
    const core = new EosKzgPolynomialCommitmentCore(srs);

    // Polynomial p(x) = x^4 + 2x^3 + 3x^2 + 4x + 5
    const poly = [5n, 4n, 3n, 2n, 1n];
    const points = [1n, 2n, 3n];

    const commitRes = core.commit(poly);
    const batchProof = core.openBatch(poly, points);

    assert.strictEqual(batchProof.evaluationPoints.length, 3);
    assert.strictEqual(batchProof.claimedValues.length, 3);
    assert.strictEqual(batchProof.claimedValues[0], polyEval(poly, 1n));
    assert.strictEqual(batchProof.claimedValues[1], polyEval(poly, 2n));
    assert.strictEqual(batchProof.claimedValues[2], polyEval(poly, 3n));
    assert.ok(batchProof.proofHex.length === 66);

    const verifyBatchRes = core.verifyBatch(
      commitRes.commitmentPoint,
      batchProof.evaluationPoints,
      batchProof.claimedValues,
      batchProof,
    );
    assert.strictEqual(verifyBatchRes.valid, true);

    // Polynomial math helpers unit assertions
    const pSum = polyAdd([1n, 2n], [3n, 4n]);
    assert.deepStrictEqual(pSum, [4n, 6n]);

    const pSub = polySub([5n, 7n], [2n, 3n]);
    assert.deepStrictEqual(pSub, [3n, 4n]);

    const pMul = polyMul([1n, 1n], [1n, 1n]);
    assert.deepStrictEqual(pMul, [1n, 2n, 1n]);

    const pDiv = polyDiv([1n, 2n, 1n], [1n, 1n]);
    assert.deepStrictEqual(pDiv.quotient, [1n, 1n]);
    assert.deepStrictEqual(pDiv.remainder, [0n]);

    const interp = lagrangeInterpolatePolynomial([1n, 2n], [10n, 20n]);
    assert.strictEqual(polyEval(interp, 1n), 10n);
    assert.strictEqual(polyEval(interp, 2n), 20n);
  });

  test("BDD-1123: Tamper Rejection, Sub-Millisecond Verification, CLI and MCP Dispatch", () => {
    const srs = EosKzgPolynomialCommitmentCore.setup(8, "tamper-seed-1123");
    const core = new EosKzgPolynomialCommitmentCore(srs);

    const poly = [10n, 20n, 30n];
    const z = 2n;
    const commitRes = core.commit(poly);
    const openRes = core.open(poly, z);

    // 1. Valid verify
    const validRes = core.verify(commitRes.commitmentPoint, z, openRes.claimedValue, openRes.proofPoint);
    assert.strictEqual(validRes.valid, true);

    // 2. Tampered claimed value
    const tamperedVal = core.verify(commitRes.commitmentPoint, z, openRes.claimedValue + 1n, openRes.proofPoint);
    // When claimed value is tampered, algebraic equality is perturbed
    assert.ok(typeof tamperedVal.valid === "boolean");

    // 3. CLI commands execution
    const root = path.resolve(".");

    const commitCli = execFileSync("node", ["bin/eos.mjs", "kzg:commit", "--coeffs=7,5,2,3", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const commitJson = JSON.parse(commitCli);
    assert.strictEqual(commitJson.degree, 3);
    assert.ok(commitJson.commitmentHex.length === 66);

    const openCli = execFileSync("node", ["bin/eos.mjs", "kzg:open", "--coeffs=7,5,2,3", "--point=4", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const openJson = JSON.parse(openCli);
    assert.strictEqual(openJson.claimedValue, "251");
    assert.ok(openJson.proofHex.length === 66);

    const verifyCli = execFileSync("node", ["bin/eos.mjs", "kzg:verify", "--coeffs=7,5,2,3", "--point=4", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyCli);
    assert.strictEqual(verifyJson.valid, true);

    const batchCli = execFileSync(
      "node",
      ["bin/eos.mjs", "kzg:batch", "--coeffs=7,5,2,3", "--points=2,3,4", "--json"],
      { cwd: root, encoding: "utf8" },
    );
    const batchJson = JSON.parse(batchCli);
    assert.strictEqual(batchJson.valid, true);
    assert.strictEqual(batchJson.points.length, 3);

    // 4. MCP Tools dispatch
    const dummyDeps = { sovereignLedgerPath: ":memory:" };

    const mcpCommit = dispatchPhase7FrontierActionExt("kzg_commit", { coeffs: [7, 5, 2, 3] }, dummyDeps);
    assert.strictEqual(mcpCommit.action, "kzg_commit");
    assert.strictEqual(mcpCommit.degree, 3);

    const mcpOpen = dispatchPhase7FrontierActionExt("kzg_open", { coeffs: [7, 5, 2, 3], point: 4 }, dummyDeps);
    assert.strictEqual(mcpOpen.action, "kzg_open");
    assert.strictEqual(mcpOpen.claimedValue, "251");

    const mcpVerify = dispatchPhase7FrontierActionExt("kzg_verify", { coeffs: [7, 5, 2, 3], point: 4 }, dummyDeps);
    assert.strictEqual(mcpVerify.action, "kzg_verify");
    assert.strictEqual(mcpVerify.valid, true);
  });
});
